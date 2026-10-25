using System.Globalization;
using Dev.Service.Model;
using Vidyano.Service;
using Vidyano.Service.Repository;

namespace Dev.Service.Actions;

/// <summary>
/// Read-only actions for the QueryGrid_Continuation test query (see packages/vidyano/tests/query-grid/README.md).
/// </summary>
/// <remarks>
/// The query pages with continuation tokens instead of a known total: while more rows follow, the result has
/// <c>Continuation = "offset:&lt;n&gt;"</c> (which makes Vidyano send <c>totalItems: -1</c>). The last page has no token and
/// the real total. The token is the 0-based index of the next row in the current sort, text search and filters, so a
/// request with a token ignores the client's <c>skip</c>. Sorting, text search and column filters still run on the
/// server (Vidyano applies them to the returned source before paging).
/// </remarks>
public partial class ContinuationRowActions
{
    public const string TokenPrefix = "offset:";

    /// <summary>
    /// Query requests that page; other reasons (distincts, counts, all selected, exports, ...) see the whole query.
    /// </summary>
    static bool IsPaged(ExecuteQueryReason reason) => reason is ExecuteQueryReason.Unknown or ExecuteQueryReason.GetQuery;

    public override void OnConstruct(Query query, PersistentObject? parent)
    {
        base.OnConstruct(query, parent);

        QueryGridTestData.MakeReadOnly(query);
    }

    public override void OnLoad(PersistentObject obj, PersistentObject? parent)
    {
        base.OnLoad(obj, parent);

        obj.IsReadOnly = true;
    }

    /// <summary>
    /// Source of QueryGrid_Continuation (<c>Custom.ContinuationPages</c>). Turns an incoming token into the query's skip, so
    /// Vidyano's own paging (after sorting, text search and filters) starts at the token's row.
    /// </summary>
    public IQueryable<ContinuationRow> ContinuationPages(CustomQueryArgs args)
    {
        var query = args.Query;
        if (IsPaged(args.Reason) && !string.IsNullOrEmpty(query.Continuation))
            query.Skip = ParseToken(query.Continuation);

        return DevContext._continuationRows.AsQueryable();
    }

    public override void QueryExecuted(QueryExecutedArgs args)
    {
        base.QueryExecuted(args);

        var result = args.Result;
        if (result == null || !IsPaged(args.Reason) || result.PageSize <= 0)
            return;

        // Vidyano computes the real total (or -1 when it was told not to count and more rows exist)
        var offset = args.Query.Skip.GetValueOrDefault();
        var next = offset + result.Items.Length;
        var hasMore = result.TotalItems == -1 || next < result.TotalItems;

        // Setting a token also sets TotalItems to -1; the last page keeps the real total and has no token
        result.Continuation = hasMore ? TokenPrefix + next.ToString(CultureInfo.InvariantCulture) : null;
    }

    static int ParseToken(string token)
    {
        if (token.StartsWith(TokenPrefix, StringComparison.Ordinal)
            && int.TryParse(token.AsSpan(TokenPrefix.Length), NumberStyles.None, CultureInfo.InvariantCulture, out var offset))
            return offset;

        throw new FaultException($"Invalid continuation token '{token}'.");
    }

    protected override void PersistToContext(PersistentObject obj, ContinuationRow entity) => throw QueryGridTestData.ReadOnlyFault();

    public override void OnDelete(PersistentObject? parent, IEnumerable<ContinuationRow> entities, Query query, QueryResultItem[] selectedItems) => throw QueryGridTestData.ReadOnlyFault();
}
