using Dev.Service.Model;
using Vidyano.Service.Repository;

namespace Dev.Service.Actions;

/// <summary>
/// Read-only actions for the QueryGrid_DataTypes test query (see packages/vidyano/tests/query-grid/README.md).
/// </summary>
public partial class GridDataTypeActions
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

    public override void QueryExecuted(QueryExecutedArgs args)
    {
        base.QueryExecuted(args);

        foreach (var item in args.Items)
        {
            switch (item.Id)
            {
                case "2":
                    item.AddTypeHint("ExtraClass", "disabled");
                    break;

                case "3":
                    item.AddTypeHint("ExtraClass", "readonly");
                    break;

                case "4":
                    item.AddTypeHint("ExtraClass", "vip highlight");
                    item.GetFullValue(AttributeNames.GridDataType.Text)?.AddTypeHint("Foreground", "rgb(255, 0, 0)");
                    break;

                case "5":
                    item.GetFullValue(AttributeNames.GridDataType.Text)?.AddTypeHint("Tag", "rgb(46, 125, 50)");
                    break;

                case "6":
                    item.GetFullValue(AttributeNames.GridDataType.Int32)?.AddTypeHint("Style", "font-weight: bold; color: rgb(0, 0, 255)");
                    item.GetFullValue(AttributeNames.GridDataType.Text)?.AddTypeHint("HoverStyle", "background-color: rgb(255, 255, 0)");
                    break;

                case "7":
                    item.AddTypeHint("OpenAction", ActionNames.TestCountSingle);
                    break;
            }
        }
    }

    protected override void GetTotalItem(Source<GridDataType> source, TotalItemArgs args)
    {
        // Sums Int32 and Decimal (DisplaySum on those attributes); Text also has DisplaySum so it is part of the
        // total row and can carry the label (strings are not summed).
        base.GetTotalItem(source, args);

        args.SetValue(AttributeNames.GridDataType.Text, "Total");
    }

    protected override void PersistToContext(PersistentObject obj, GridDataType entity) => throw QueryGridTestData.ReadOnlyFault();

    public override void OnDelete(PersistentObject? parent, IEnumerable<GridDataType> entities, Query query, QueryResultItem[] selectedItems) => throw QueryGridTestData.ReadOnlyFault();
}
