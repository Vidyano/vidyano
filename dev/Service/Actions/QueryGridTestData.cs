using System.Reflection;
using Vidyano.Service;
using Vidyano.Service.Repository;

namespace Dev.Service.Actions;

/// <summary>
/// Helpers for the read-only vi-query-grid test queries (see packages/vidyano/tests/query-grid/README.md).
/// </summary>
public static class QueryGridTestData
{
    static readonly string[] mutatingActions = ["New", "BulkEdit", "Delete", "NewPersonWizard", "SendEmail"];

    /// <summary>
    /// Removes the actions that could change the test data.
    /// </summary>
    public static void MakeReadOnly(Query query)
    {
        query.Actions = query.Actions?.Except(mutatingActions).ToArray();
        query.DisableBulkEdit = true;
    }

    public static FaultException ReadOnlyFault() => new("This test data is read-only.");

    // QueryColumn.CanSort/CanFilter/CanListDistincts only have internal setters (the model JSON ignores them on columns),
    // so per-query overrides need reflection.
    public static void SetCanSort(QueryColumn column, bool value) => SetInternal(column, "CanSort", value);

    public static void SetCanFilter(QueryColumn column, bool value) => SetInternal(column, "CanFilter", value);

    public static void SetCanListDistincts(QueryColumn column, bool value) => SetInternal(column, "CanListDistincts", value);

    static void SetInternal(QueryColumn column, string propertyName, bool value)
    {
        var property = typeof(QueryColumn).GetProperty(propertyName, BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic)
            ?? throw new InvalidOperationException($"QueryColumn.{propertyName} not found.");

        property.SetValue(column, (bool?)value);
    }
}
