import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Database,
  Search,
  Plus,
  Edit3,
  Trash2,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Terminal,
  AlertTriangle,
  Check,
  X,
  Table,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { api } from "@/lib/api";
import { Toast, ToastContainer } from "./ui/toast";

interface TableInfo {
  name: string;
  row_count: number;
  columns: ColumnInfo[];
}

interface ColumnInfo {
  cid: number;
  name: string;
  type_name: string;
  notnull: boolean;
  dflt_value: string | null;
  pk: boolean;
}

interface TableData {
  table_name: string;
  columns: ColumnInfo[];
  rows: Record<string, any>[];
  total_rows: number;
  page: number;
  page_size: number;
  total_pages: number;
}

interface QueryResult {
  columns: string[];
  rows: any[][];
  rows_affected?: number;
  last_insert_rowid?: number;
}

/**
 * StorageTab component - A beautiful SQLite database viewer/editor
 */
export const StorageTab: React.FC = () => {
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>("");
  const [tableData, setTableData] = useState<TableData | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(25);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dialog states
  const [editingRow, setEditingRow] = useState<Record<string, any> | null>(null);
  const [newRow, setNewRow] = useState<Record<string, any> | null>(null);
  const [deletingRow, setDeletingRow] = useState<Record<string, any> | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showSqlEditor, setShowSqlEditor] = useState(false);
  const [sqlQuery, setSqlQuery] = useState("");
  const [sqlResult, setSqlResult] = useState<QueryResult | null>(null);
  const [sqlError, setSqlError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  /**
   * Load all tables on mount
   */
  useEffect(() => {
    loadTables();
  }, []);

  /**
   * Load table data when selected table changes
   */
  useEffect(() => {
    if (selectedTable) {
      loadTableData(1);
    }
  }, [selectedTable]);

  /**
   * Load all tables from the database
   */
  const loadTables = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await api.storageListTables();
      setTables(result);
      if (result.length > 0 && !selectedTable) {
        setSelectedTable(result[0].name);
      }
    } catch (err) {
      console.error("Failed to load tables:", err);
      setError("Failed to load tables");
    } finally {
      setLoading(false);
    }
  };

  /**
   * Load data for the selected table
   */
  const loadTableData = async (page: number, search?: string) => {
    if (!selectedTable) return;

    try {
      setLoading(true);
      setError(null);
      const result = await api.storageReadTable(
        selectedTable,
        page,
        pageSize,
        search || searchQuery || undefined
      );
      setTableData(result);
      setCurrentPage(page);
    } catch (err) {
      console.error("Failed to load table data:", err);
      setError("Failed to load table data");
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle search
   */
  const handleSearch = useCallback(
    (value: string) => {
      setSearchQuery(value);
      loadTableData(1, value);
    },
    [selectedTable]
  );

  /**
   * Get primary key values for a row
   */
  const getPrimaryKeyValues = (row: Record<string, any>): Record<string, any> => {
    if (!tableData) return {};
    
    const pkColumns = tableData.columns.filter(col => col.pk);
    const pkValues: Record<string, any> = {};
    
    pkColumns.forEach(col => {
      pkValues[col.name] = row[col.name];
    });
    
    return pkValues;
  };

  /**
   * Handle row update
   */
  const handleUpdateRow = async (updates: Record<string, any>) => {
    if (!editingRow || !selectedTable) return;

    try {
      setLoading(true);
      const pkValues = getPrimaryKeyValues(editingRow);
      await api.storageUpdateRow(selectedTable, pkValues, updates);
      await loadTableData(currentPage);
      setEditingRow(null);
    } catch (err) {
      console.error("Failed to update row:", err);
      setError("Failed to update row");
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle row deletion
   */
  const handleDeleteRow = async () => {
    if (!deletingRow || !selectedTable) return;

    try {
      setLoading(true);
      const pkValues = getPrimaryKeyValues(deletingRow);
      await api.storageDeleteRow(selectedTable, pkValues);
      await loadTableData(currentPage);
      setDeletingRow(null);
    } catch (err) {
      console.error("Failed to delete row:", err);
      setError("Failed to delete row");
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle new row insertion
   */
  const handleInsertRow = async (values: Record<string, any>) => {
    if (!selectedTable) return;

    try {
      setLoading(true);
      await api.storageInsertRow(selectedTable, values);
      await loadTableData(currentPage);
      setNewRow(null);
    } catch (err) {
      console.error("Failed to insert row:", err);
      setError("Failed to insert row");
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle SQL query execution
   */
  const handleExecuteSql = async () => {
    try {
      setLoading(true);
      setSqlError(null);
      const result = await api.storageExecuteSql(sqlQuery);
      setSqlResult(result);
      
      // Refresh tables and data if it was a non-SELECT query
      if (result.rows_affected !== undefined) {
        await loadTables();
        if (selectedTable) {
          await loadTableData(currentPage);
        }
      }
    } catch (err) {
      console.error("Failed to execute SQL:", err);
      setSqlError(err instanceof Error ? err.message : "Failed to execute SQL");
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle database reset
   */
  const handleResetDatabase = async () => {
    try {
      setLoading(true);
      await api.storageResetDatabase();
      await loadTables();
      setSelectedTable("");
      setTableData(null);
      setShowResetConfirm(false);
      setToast({
        message: "Database Reset Complete: The database has been restored to its default state with empty tables (agents, agent_runs, app_settings).",
        type: "success",
      });
    } catch (err) {
      console.error("Failed to reset database:", err);
      setError("Failed to reset database");
      setToast({
        message: "Reset Failed: Failed to reset the database. Please try again.",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Format cell value for display
   */
  const formatCellValue = (value: any, maxLength: number = 100): string => {
    if (value === null) return "NULL";
    if (value === undefined) return "";
    if (typeof value === "boolean") return value ? "true" : "false";
    if (typeof value === "object") return JSON.stringify(value);
    
    const stringValue = String(value);
    if (stringValue.length > maxLength) {
      return stringValue.substring(0, maxLength) + "...";
    }
    return stringValue;
  };

  /**
   * Get input type for column
   */
  const getInputType = (column: ColumnInfo): string => {
    const type = column.type_name.toUpperCase();
    if (type.includes("INT")) return "number";
    if (type.includes("REAL") || type.includes("FLOAT") || type.includes("DOUBLE")) return "number";
    if (type.includes("BOOL")) return "checkbox";
    return "text";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Database className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Database Storage</h3>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSqlEditor(true)}
                className="gap-2 h-8 text-xs"
              >
                <Terminal className="h-3 w-3" />
                SQL Query
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowResetConfirm(true)}
                className="gap-2 h-8 text-xs"
              >
                <RefreshCw className="h-3 w-3" />
                Reset DB
              </Button>
            </div>
          </div>

          {/* Table Selector and Search */}
          <div className="flex items-center gap-3">
            <Select value={selectedTable} onValueChange={setSelectedTable}>
              <SelectTrigger className="w-[200px] h-8 text-xs">
                <SelectValue placeholder="Select a table">
                  {selectedTable && (
                    <div className="flex items-center gap-2">
                      <Table className="h-3 w-3" />
                      {selectedTable}
                    </div>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {tables.map((table) => (
                  <SelectItem key={table.name} value={table.name} className="text-xs">
                    <div className="flex items-center justify-between w-full">
                      <span>{table.name}</span>
                      <span className="text-[10px] text-muted-foreground ml-2">
                        {table.row_count} rows
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              <Input
                placeholder="Search in table..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>

            {tableData && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setNewRow({})}
                className="gap-2 h-8 text-xs"
              >
                <Plus className="h-3 w-3" />
                New Row
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Table Data */}
      {tableData && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  {tableData.columns.map((column) => (
                    <th
                      key={column.name}
                      className="px-3 py-2 text-left text-xs font-medium text-muted-foreground"
                    >
                      <div className="flex items-center gap-1">
                        {column.name}
                        {column.pk && (
                          <span className="text-[10px] text-primary">PK</span>
                        )}
                      </div>
                      <div className="text-[10px] font-normal">
                        {column.type_name}
                      </div>
                    </th>
                  ))}
                  <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {tableData.rows.map((row, index) => (
                    <motion.tr
                      key={index}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="border-b hover:bg-muted/25 transition-colors"
                    >
                      {tableData.columns.map((column) => {
                        const value = row[column.name];
                        const formattedValue = formatCellValue(value, 50);
                        const fullValue = value === null ? "NULL" : 
                                        value === undefined ? "" : 
                                        typeof value === "object" ? JSON.stringify(value, null, 2) : 
                                        String(value);
                        const isTruncated = fullValue.length > 50;
                        
                        return (
                          <td
                            key={column.name}
                            className="px-3 py-2 text-xs font-mono"
                          >
                            {isTruncated ? (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="cursor-help block truncate max-w-[200px]">
                                      {formattedValue}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent 
                                    side="bottom" 
                                    className="max-w-[500px] max-h-[300px] overflow-auto"
                                  >
                                    <pre className="text-xs whitespace-pre-wrap">{fullValue}</pre>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            ) : (
                              <span className="block truncate max-w-[200px]">
                                {formattedValue}
                              </span>
                            )}
                          </td>
                        );
                      })}
                      <td className="px-3 py-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setEditingRow(row)}
                            className="h-6 w-6"
                          >
                            <Edit3 className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeletingRow(row)}
                            className="h-6 w-6 hover:text-destructive"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {tableData.total_pages > 1 && (
            <div className="flex items-center justify-between p-3 border-t">
              <div className="text-xs text-muted-foreground">
                Showing {(currentPage - 1) * pageSize + 1} to{" "}
                {Math.min(currentPage * pageSize, tableData.total_rows)} of{" "}
                {tableData.total_rows} rows
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => loadTableData(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="h-7 text-xs"
                >
                  <ChevronLeft className="h-3 w-3" />
                  Previous
                </Button>
                <div className="text-xs">
                  Page {currentPage} of {tableData.total_pages}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => loadTableData(currentPage + 1)}
                  disabled={currentPage === tableData.total_pages}
                  className="h-7 text-xs"
                >
                  Next
                  <ChevronRight className="h-3 w-3" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Error State */}
      {error && (
        <Card className="p-6 border-destructive/50 bg-destructive/10">
          <div className="flex items-center gap-3 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            <span className="font-medium">{error}</span>
          </div>
        </Card>
      )}

      {/* Edit Row Dialog */}
      <Dialog open={!!editingRow} onOpenChange={() => setEditingRow(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Row</DialogTitle>
            <DialogDescription>
              Update the values for this row in the {selectedTable} table.
            </DialogDescription>
          </DialogHeader>
          {editingRow && tableData && (
            <div className="space-y-4">
              {tableData.columns.map((column) => (
                <div key={column.name} className="space-y-2">
                  <Label htmlFor={`edit-${column.name}`}>
                    {column.name}
                    {column.pk && (
                      <span className="text-xs text-muted-foreground ml-2">
                        (Primary Key)
                      </span>
                    )}
                  </Label>
                  {getInputType(column) === "checkbox" ? (
                    <input
                      type="checkbox"
                      id={`edit-${column.name}`}
                      checked={!!editingRow[column.name]}
                      onChange={(e) =>
                        setEditingRow({
                          ...editingRow,
                          [column.name]: e.target.checked,
                        })
                      }
                      disabled={column.pk}
                      className="h-4 w-4"
                    />
                  ) : (
                    <Input
                      id={`edit-${column.name}`}
                      type={getInputType(column)}
                      value={editingRow[column.name] ?? ""}
                      onChange={(e) =>
                        setEditingRow({
                          ...editingRow,
                          [column.name]: e.target.value,
                        })
                      }
                      disabled={column.pk}
                      placeholder={column.dflt_value || "NULL"}
                    />
                  )}
                  <p className="text-xs text-muted-foreground">
                    Type: {column.type_name}
                    {column.notnull && ", NOT NULL"}
                    {column.dflt_value && `, Default: ${column.dflt_value}`}
                  </p>
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingRow(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => handleUpdateRow(editingRow!)}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Update"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Row Dialog */}
      <Dialog open={!!newRow} onOpenChange={() => setNewRow(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Row</DialogTitle>
            <DialogDescription>
              Add a new row to the {selectedTable} table.
            </DialogDescription>
          </DialogHeader>
          {newRow && tableData && (
            <div className="space-y-4">
              {tableData.columns.map((column) => (
                <div key={column.name} className="space-y-2">
                  <Label htmlFor={`new-${column.name}`}>
                    {column.name}
                    {column.notnull && (
                      <span className="text-xs text-destructive ml-2">
                        (Required)
                      </span>
                    )}
                  </Label>
                  {getInputType(column) === "checkbox" ? (
                    <input
                      type="checkbox"
                      id={`new-${column.name}`}
                      checked={newRow[column.name] || false}
                      onChange={(e) =>
                        setNewRow({
                          ...newRow,
                          [column.name]: e.target.checked,
                        })
                      }
                      className="h-4 w-4"
                    />
                  ) : (
                    <Input
                      id={`new-${column.name}`}
                      type={getInputType(column)}
                      value={newRow[column.name] ?? ""}
                      onChange={(e) =>
                        setNewRow({
                          ...newRow,
                          [column.name]: e.target.value,
                        })
                      }
                      placeholder={column.dflt_value || "NULL"}
                    />
                  )}
                  <p className="text-xs text-muted-foreground">
                    Type: {column.type_name}
                    {column.dflt_value && `, Default: ${column.dflt_value}`}
                  </p>
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewRow(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => handleInsertRow(newRow!)}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Insert"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deletingRow} onOpenChange={() => setDeletingRow(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Row</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this row? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          {deletingRow && (
            <div className="rounded-md bg-muted p-4">
              <pre className="text-xs font-mono overflow-x-auto max-h-[200px] overflow-y-auto">
                {JSON.stringify(
                  Object.fromEntries(
                    Object.entries(deletingRow).map(([key, value]) => [
                      key,
                      typeof value === "string" && value.length > 100
                        ? value.substring(0, 100) + "..."
                        : value
                    ])
                  ),
                  null,
                  2
                )}
              </pre>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingRow(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteRow}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Database Confirmation */}
      <Dialog open={showResetConfirm} onOpenChange={setShowResetConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Database</DialogTitle>
            <DialogDescription>
              This will delete all data and recreate the database with its default structure 
              (empty tables for agents, agent_runs, and app_settings). The database will be 
              restored to the same state as when you first installed the app. This action 
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-3 p-4 rounded-md bg-destructive/10 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            <span className="text-sm font-medium">
              All your agents, runs, and settings will be permanently deleted!
            </span>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowResetConfirm(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleResetDatabase}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Reset Database"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* SQL Query Editor */}
      <Dialog open={showSqlEditor} onOpenChange={setShowSqlEditor}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>SQL Query Editor</DialogTitle>
            <DialogDescription>
              Execute raw SQL queries on the database. Use with caution.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sql-query">SQL Query</Label>
              <Textarea
                id="sql-query"
                value={sqlQuery}
                onChange={(e) => setSqlQuery(e.target.value)}
                placeholder="SELECT * FROM agents LIMIT 10;"
                className="font-mono text-sm h-32"
              />
            </div>

            {sqlError && (
              <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                <div className="flex items-center gap-2">
                  <X className="h-4 w-4" />
                  {sqlError}
                </div>
              </div>
            )}

            {sqlResult && (
              <div className="space-y-2">
                {sqlResult.rows_affected !== undefined ? (
                  <div className="p-3 rounded-md bg-green-500/10 text-green-600 dark:text-green-400 text-sm">
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4" />
                      Query executed successfully. {sqlResult.rows_affected} rows
                      affected.
                      {sqlResult.last_insert_rowid && (
                        <span>
                          Last insert ID: {sqlResult.last_insert_rowid}
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="border rounded-md overflow-hidden">
                    <div className="overflow-x-auto max-h-96">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b bg-muted/50">
                            {sqlResult.columns.map((col, i) => (
                              <th
                                key={i}
                                className="px-2 py-1 text-left font-medium"
                              >
                                {col}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {sqlResult.rows.map((row, i) => (
                            <tr key={i} className="border-b">
                              {row.map((cell, j) => {
                                const formattedValue = formatCellValue(cell, 50);
                                const fullValue = cell === null ? "NULL" : 
                                                cell === undefined ? "" : 
                                                typeof cell === "object" ? JSON.stringify(cell, null, 2) : 
                                                String(cell);
                                const isTruncated = fullValue.length > 50;
                                
                                return (
                                  <td key={j} className="px-2 py-1 font-mono">
                                    {isTruncated ? (
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <span className="cursor-help block truncate max-w-[200px]">
                                              {formattedValue}
                                            </span>
                                          </TooltipTrigger>
                                          <TooltipContent 
                                            side="bottom" 
                                            className="max-w-[500px] max-h-[300px] overflow-auto"
                                          >
                                            <pre className="text-xs whitespace-pre-wrap">{fullValue}</pre>
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    ) : (
                                      <span className="block truncate max-w-[200px]">
                                        {formattedValue}
                                      </span>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowSqlEditor(false);
                setSqlQuery("");
                setSqlResult(null);
                setSqlError(null);
              }}
            >
              Close
            </Button>
            <Button
              onClick={handleExecuteSql}
              disabled={loading || !sqlQuery.trim()}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Execute"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Toast Notification */}
      <ToastContainer>
        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onDismiss={() => setToast(null)}
          />
        )}
      </ToastContainer>
    </div>
  );
}; 