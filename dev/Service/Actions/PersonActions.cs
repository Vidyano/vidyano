using Dev.Service.Model;
using DocumentFormat.OpenXml.Vml.Office;
using Vidyano.Core.Extensions;
using Vidyano.Service.ClientOperations;
using Vidyano.Service.Repository;

namespace Dev.Service.Actions;

public partial class PersonActions
{
    public override void OnConstruct(Query query, PersistentObject? parent)
    {
        base.OnConstruct(query, parent);

        if (query.Name.StartsWith("QueryGrid_"))
        {
            switch (query.Name.Substring("QueryGrid_".Length))
            {
                case "None":
                    query.Actions = null;
                    break;

                case "Select":
                    query.Actions = [ActionNames.MoreThanOne];
                    break;

                case "Filter":
                // Only used by the saved filters spec, so the default filters it saves never reach another spec
                case "SavedFilters":
                    query.Actions = [ActionNames.Filter];
                    break;

                case "InlineActions":
                    query.Actions = [ActionNames.One];
                    break;

                case "SelectAndFilter":
                    query.Actions = [ActionNames.MoreThanOne, ActionNames.Filter];
                    break;

                case "SelectAndInlineActions":
                    query.Actions = query.Actions.Except(["Filter"]).ToArray();
                    break;

                case "ColumnOptions":
                    ApplyColumnOptions(query.Columns);
                    break;
            }
        }
        else
        {
            query.EnableSelectAll = true;

            // 150k projected copies of People: read-only, mutations would hit the real People list
            if (query.Name == QueryNames.PeopleBig)
                QueryGridTestData.MakeReadOnly(query);
        }
    }

    /// <summary>
    /// Per-query column overrides for QueryGrid_ColumnOptions (see packages/vidyano/tests/query-grid/README.md).
    /// </summary>
    /// <remarks>
    /// Applied to the query columns (OnConstruct) and to the result columns (QueryExecuted), the client uses the latter
    /// when the query is returned with a result. CanSort/CanFilter/CanListDistincts have internal setters on QueryColumn.
    /// </remarks>
    static void ApplyColumnOptions(IEnumerable<QueryColumn>? columns)
    {
        if (columns == null)
            return;

        foreach (var column in columns)
        {
            switch (column.Name)
            {
                case AttributeNames.Person.FirstName:
                    column.Label = "First name of the person as registered in the population register";
                    break;

                case AttributeNames.Person.LastName:
                    column.IsSensitive = true;
                    break;

                case AttributeNames.Person.BirthDate:
                    column.IsPinned = true;
                    break;

                case AttributeNames.Person.Gender:
                    column.IsHidden = true;
                    break;

                case AttributeNames.Person.ContactPreference:
                    column.Width = "200px";
                    break;

                case AttributeNames.Person.Email:
                    QueryGridTestData.SetCanListDistincts(column, false);
                    break;

                case AttributeNames.Person.PhoneNumber:
                    QueryGridTestData.SetCanSort(column, false);
                    QueryGridTestData.SetCanFilter(column, false);
                    break;

                case AttributeNames.Person.EmergencyContact:
                    column.Width = "0";
                    break;
            }
        }
    }

    public override void QueryExecuted(QueryExecutedArgs args)
    {
        base.QueryExecuted(args);

        if (args.Query.Name == QueryNames.QueryGrid_ColumnOptions)
            ApplyColumnOptions(args.Result?.Columns);
    }

    public override void PreClient(PersistentObject obj)
    {
        base.PreClient(obj);

        var preference = (ContactPreference)Enum.Parse(typeof(ContactPreference), (string)obj[AttributeNames.Person.ContactPreference]!);
        if (preference == ContactPreference.Email)
        {
            obj[AttributeNames.Person.PhoneNumber].RemoveRule(BusinessRuleNames.NotEmpty);
            obj[AttributeNames.Person.Email].AddRule(BusinessRuleNames.NotEmpty);
        }
        else if (preference == ContactPreference.Phone)
        {
            obj[AttributeNames.Person.PhoneNumber].AddRule(BusinessRuleNames.NotEmpty);
            obj[AttributeNames.Person.Email].RemoveRule(BusinessRuleNames.NotEmpty);
        }
    }

    protected override void GetGroupingInfo(Source<Person> source, GroupingInfoArgs args)
    {
        // Group BirthDate by year
        if (args.GroupedBy.Name == AttributeNames.Person.BirthDate)
            args.GroupConvertor = date => date[^4..];

        base.GetGroupingInfo(source, args);
    }

    protected override void PersistToContext(PersistentObject obj, Person entity)
    {
        if (obj.IsNew)
        {
            entity.Id = DevContext._people.Count + 1;
            DevContext._people.Add(entity);
        }

        Manager.Current.QueueClientOperation(RefreshOperation.Query(QueryNames.People));
    }

    public override void OnDelete(PersistentObject parent, IEnumerable<Person> entities, Query query, QueryResultItem[] selectedItems)
    {
        entities.Run(e => DevContext._people.Remove(e));
    }

    public override Stream OnGetStream(GetStreamArgs e)
    {
        var ids = e.Key.Split(",").Select(id => id.Trim());
        var result = string.Join("\n", ids);

        return e.GetBytes(System.Text.Encoding.UTF8.GetBytes(result), "SelectedIds.txt", "text/plain");
    }
}