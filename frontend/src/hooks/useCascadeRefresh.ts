import { useCallback } from "react";
import { useStore } from "./useStore";
import { runQuery } from "@/lib/api";
import type { CascadeRule, DimensionSource } from "@/types/dashboard";

/**
 * Returns a callback that, given a parent filter id (column name or dim source id)
 * and its selected values, refreshes all child filters per the cascade rules.
 */
export function useCascadeRefresh() {
  const {
    cascadeRules,
    dimensionSources,
    dimensionFilters,
    filters,
    setFilterValues,
    setFilterSelection,
    setDimensionFilterValues,
    setDimensionFilterSelection,
    activeWorkspace,
    bumpCascadeVersion,
  } = useStore();

  const triggerCascade = useCallback(
    async (parentFilterId: string, parentSelectedValues: string[]) => {
      if (cascadeRules.length === 0) return;

      const isParentDim = parentFilterId.startsWith("dim-");
      const parentRef = isParentDim ? parentFilterId.replace("dim-", "") : parentFilterId;

      const matchingRules = cascadeRules.filter((r) => {
        if (r.parentType === "dimension") return r.parentId === parentRef;
        return r.parentId === parentRef;
      });

      if (matchingRules.length === 0) return;

      const fqTable = (() => {
        const ds = activeWorkspace?.datasource;
        if (ds?.source_mode === "query" && ds?.custom_query) {
          return `(${ds.custom_query}) AS __custom_source__`;
        }
        if (!ds?.catalog || !ds?.schema || !ds?.default_table) return "";
        return `\`${ds.catalog}\`.\`${ds.schema}\`.\`${ds.default_table}\``;
      })();

      const parentColumn = isParentDim
        ? dimensionSources.find((d) => d.id === parentRef)?.column ?? parentRef
        : parentRef;

      for (const rule of matchingRules) {
        await refreshChild(rule, parentColumn, parentSelectedValues, fqTable);
      }

      bumpCascadeVersion();
    },
    [cascadeRules, dimensionSources, dimensionFilters, filters, activeWorkspace,
     setFilterValues, setFilterSelection, setDimensionFilterValues, setDimensionFilterSelection, bumpCascadeVersion],
  );

  const refreshChild = async (
    rule: CascadeRule,
    parentColumn: string,
    parentValues: string[],
    fqTable: string,
  ) => {
    if (rule.childType === "dimension") {
      await refreshDimensionChild(rule, parentColumn, parentValues, fqTable);
    } else {
      await refreshColumnChild(rule, parentColumn, parentValues, fqTable);
    }
  };

  const refreshDimensionChild = async (
    rule: CascadeRule,
    parentColumn: string,
    parentValues: string[],
    fqTable: string,
  ) => {
    const dimSource = dimensionSources.find((d) => d.id === rule.childId);
    if (!dimSource) return;

    const filterId = `dim-${dimSource.id}`;
    const linkCol = rule.linkColumn || parentColumn;

    if (parentValues.length === 0) {
      reloadFullDimensionValues(dimSource, filterId);
      return;
    }

    const inClause = parentValues.map((v) => `'${v.replace(/'/g, "''")}'`).join(", ");

    try {
      if (dimSource.sourceType === "static") {
        // Nothing to filter for static - keep all values
        return;
      }

      if (dimSource.sourceType === "table" && dimSource.tableName) {
        const cat = dimSource.tableCatalog || "";
        const sch = dimSource.tableSchema || "";
        const tbl = dimSource.tableName;
        const fqLookup = cat && sch ? `\`${cat}\`.\`${sch}\`.\`${tbl}\`` : tbl;
        const valCol = dimSource.valueColumn || dimSource.column;
        const dispCol = dimSource.displayColumn || "";
        const selectCols = dispCol && dispCol !== valCol
          ? `\`${valCol}\`, \`${dispCol}\``
          : `\`${valCol}\``;
        const sql = `SELECT DISTINCT ${selectCols} FROM ${fqLookup} WHERE \`${linkCol}\` IN (${inClause}) AND \`${valCol}\` IS NOT NULL ORDER BY \`${valCol}\` LIMIT 1000`;
        const result = await runQuery(sql, 1000);
        const valIdx = result.columns.indexOf(valCol);
        const dispIdx = dispCol ? result.columns.indexOf(dispCol) : -1;
        const values: string[] = [];
        const dmap: Record<string, string> = {};
        for (const row of result.rows) {
          const v = String(row[valIdx >= 0 ? valIdx : 0] ?? "");
          if (!v) continue;
          values.push(v);
          if (dispIdx >= 0) {
            const d = String(row[dispIdx] ?? "");
            if (d && d !== v) dmap[v] = d;
          }
        }
        setDimensionFilterValues(filterId, values, Object.keys(dmap).length > 0 ? dmap : undefined);
        pruneSelection(filterId, values, "dimension");
      }

      if (dimSource.sourceType === "query" && dimSource.query) {
        let sql = dimSource.query;
        const hasWhere = /\bWHERE\b/i.test(sql);
        const cascadeCondition = `\`${linkCol}\` IN (${inClause})`;
        if (hasWhere) {
          sql = sql.replace(/\bWHERE\b/i, `WHERE ${cascadeCondition} AND `);
        } else {
          const insertPoint = sql.search(/\b(ORDER|GROUP|LIMIT|$)/i);
          sql = sql.slice(0, insertPoint) + ` WHERE ${cascadeCondition} ` + sql.slice(insertPoint);
        }
        const result = await runQuery(sql, 1000);
        const valCol = dimSource.valueColumn || result.columns[0];
        const dispCol = dimSource.displayColumn || "";
        const valIdx = result.columns.indexOf(valCol);
        const dispIdx = dispCol ? result.columns.indexOf(dispCol) : -1;
        const values: string[] = [];
        const dmap: Record<string, string> = {};
        for (const row of result.rows) {
          const v = String(row[valIdx >= 0 ? valIdx : 0] ?? "");
          if (!v) continue;
          values.push(v);
          if (dispIdx >= 0) {
            const d = String(row[dispIdx] ?? "");
            if (d && d !== v) dmap[v] = d;
          }
        }
        setDimensionFilterValues(filterId, values, Object.keys(dmap).length > 0 ? dmap : undefined);
        pruneSelection(filterId, values, "dimension");
      }
    } catch (err) {
      console.error("Cascade refresh failed for dimension", dimSource.id, err);
    }
  };

  const refreshColumnChild = async (
    rule: CascadeRule,
    parentColumn: string,
    parentValues: string[],
    fqTable: string,
  ) => {
    if (!fqTable) return;
    const childColumn = rule.childId;
    const filter = filters.find((f) => f.column === childColumn);
    if (!filter) return;

    if (parentValues.length === 0) {
      const sql = `SELECT DISTINCT \`${childColumn}\` FROM ${fqTable} WHERE \`${childColumn}\` IS NOT NULL ORDER BY \`${childColumn}\` LIMIT 500`;
      try {
        const result = await runQuery(sql, 500);
        const vals = result.rows.map((r) => String(r[0] ?? "")).filter(Boolean);
        setFilterValues(filter.id, vals);
      } catch (err) {
        console.error("Cascade refresh failed for column", childColumn, err);
      }
      return;
    }

    const inClause = parentValues.map((v) => `'${v.replace(/'/g, "''")}'`).join(", ");
    const sql = `SELECT DISTINCT \`${childColumn}\` FROM ${fqTable} WHERE \`${parentColumn}\` IN (${inClause}) AND \`${childColumn}\` IS NOT NULL ORDER BY \`${childColumn}\` LIMIT 500`;
    try {
      const result = await runQuery(sql, 500);
      const vals = result.rows.map((r) => String(r[0] ?? "")).filter(Boolean);
      setFilterValues(filter.id, vals);
      pruneSelection(filter.id, vals, "column");
    } catch (err) {
      console.error("Cascade refresh failed for column", childColumn, err);
    }
  };

  const reloadFullDimensionValues = async (dimSource: DimensionSource, filterId: string) => {
    try {
      if (dimSource.sourceType === "static") return;
      if (dimSource.sourceType === "table" && dimSource.tableName) {
        const cat = dimSource.tableCatalog || "";
        const sch = dimSource.tableSchema || "";
        const tbl = dimSource.tableName;
        const fqLookup = cat && sch ? `\`${cat}\`.\`${sch}\`.\`${tbl}\`` : tbl;
        const valCol = dimSource.valueColumn || dimSource.column;
        const dispCol = dimSource.displayColumn || "";
        const selectCols = dispCol && dispCol !== valCol
          ? `\`${valCol}\`, \`${dispCol}\``
          : `\`${valCol}\``;
        const sql = `SELECT DISTINCT ${selectCols} FROM ${fqLookup} WHERE \`${valCol}\` IS NOT NULL ORDER BY \`${valCol}\` LIMIT 1000`;
        const result = await runQuery(sql, 1000);
        const valIdx = result.columns.indexOf(valCol);
        const dispIdx = dispCol ? result.columns.indexOf(dispCol) : -1;
        const values: string[] = [];
        const dmap: Record<string, string> = {};
        for (const row of result.rows) {
          const v = String(row[valIdx >= 0 ? valIdx : 0] ?? "");
          if (!v) continue;
          values.push(v);
          if (dispIdx >= 0) {
            const d = String(row[dispIdx] ?? "");
            if (d && d !== v) dmap[v] = d;
          }
        }
        setDimensionFilterValues(filterId, values, Object.keys(dmap).length > 0 ? dmap : undefined);
      }
      if (dimSource.sourceType === "query" && dimSource.query) {
        const result = await runQuery(dimSource.query, 1000);
        const valCol = dimSource.valueColumn || result.columns[0];
        const dispCol = dimSource.displayColumn || "";
        const valIdx = result.columns.indexOf(valCol);
        const dispIdx = dispCol ? result.columns.indexOf(dispCol) : -1;
        const values: string[] = [];
        const dmap: Record<string, string> = {};
        for (const row of result.rows) {
          const v = String(row[valIdx >= 0 ? valIdx : 0] ?? "");
          if (!v) continue;
          values.push(v);
          if (dispIdx >= 0) {
            const d = String(row[dispIdx] ?? "");
            if (d && d !== v) dmap[v] = d;
          }
        }
        setDimensionFilterValues(filterId, values, Object.keys(dmap).length > 0 ? dmap : undefined);
      }
    } catch (err) {
      console.error("Full reload failed for dimension", dimSource.id, err);
    }
  };

  const pruneSelection = (filterId: string, newValues: string[], type: "column" | "dimension") => {
    const valSet = new Set(newValues);
    if (type === "dimension") {
      const f = useStore.getState().dimensionFilters.find((df) => df.id === filterId);
      if (f) {
        const pruned = f.selectedValues.filter((v) => valSet.has(v));
        if (pruned.length !== f.selectedValues.length) {
          setDimensionFilterSelection(filterId, pruned);
        }
      }
    } else {
      const f = useStore.getState().filters.find((ff) => ff.id === filterId);
      if (f) {
        const pruned = f.selectedValues.filter((v) => valSet.has(v));
        if (pruned.length !== f.selectedValues.length) {
          setFilterSelection(f.id, pruned);
        }
      }
    }
  };

  return triggerCascade;
}
