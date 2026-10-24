using Dev.Service.Model;
using Vidyano.Service.Repository;

namespace Dev.Service.Actions;

/// <summary>
/// Actions for the QueryGrid_Reorder and QueryGrid_ReorderLarge test queries (see packages/vidyano/tests/query-grid/README.md).
/// Only reordering is allowed; it changes the Offset of the in-memory items and is undone by PersistentObject.ResetTest
/// (DevContext.Initialize).
/// </summary>
public partial class ReorderItemActions
{
    public override void OnConstruct(Query query, PersistentObject? parent)
    {
        base.OnConstruct(query, parent);

        QueryGridTestData.MakeReadOnly(query);
        query.CanReorder = true;
    }

    public override void OnLoad(PersistentObject obj, PersistentObject? parent)
    {
        base.OnLoad(obj, parent);

        obj.IsReadOnly = true;
    }

    protected override Source<ReorderItem> Sort(Source<ReorderItem> source, SortArgs args)
    {
        // Reorderable queries are always shown in Offset order
        return source.OrderBy(i => i.Offset).ThenBy(i => i.Id);
    }

    public override void OnReorder(ReorderArgs args)
    {
        var items = args.Query.Name == QueryNames.QueryGrid_ReorderLarge ? DevContext._reorderItemsLarge : DevContext._reorderItems;

        lock (items)
            args.Apply(items.OrderBy(i => i.Offset).ThenBy(i => i.Id), i => i.Offset);
    }

    protected override void PersistToContext(PersistentObject obj, ReorderItem entity) => throw QueryGridTestData.ReadOnlyFault();

    public override void OnDelete(PersistentObject? parent, IEnumerable<ReorderItem> entities, Query query, QueryResultItem[] selectedItems) => throw QueryGridTestData.ReadOnlyFault();
}
