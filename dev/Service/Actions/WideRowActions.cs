using Dev.Service.Model;
using Vidyano.Service.Repository;

namespace Dev.Service.Actions;

/// <summary>
/// Read-only actions for the QueryGrid_Wide test query (see packages/vidyano/tests/query-grid/README.md).
/// </summary>
public partial class WideRowActions
{
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

    protected override void PersistToContext(PersistentObject obj, WideRow entity) => throw QueryGridTestData.ReadOnlyFault();

    public override void OnDelete(PersistentObject? parent, IEnumerable<WideRow> entities, Query query, QueryResultItem[] selectedItems) => throw QueryGridTestData.ReadOnlyFault();
}
