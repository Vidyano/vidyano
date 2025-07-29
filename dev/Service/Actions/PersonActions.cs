using Dev.Service.Model;
using Vidyano.Service.Repository;

namespace Dev.Service.Actions;

public partial class PersonActions
{
    public override void OnConstruct(Query query, PersistentObject? parent)
    {
        base.OnConstruct(query, parent);

        if (!query.Name.StartsWith("QueryGrid_"))
            return;

        switch (query.Name.Substring("QueryGrid_".Length))
        {
            case "None":
                query.Actions = null;
                break;

            case "Select":
                query.Actions = [ActionNames.MoreThanOne];
                break;

            case "Filter":
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
        }
    }

    protected override void GetGroupingInfo(Source<Person> source, GroupingInfoArgs args)
    {
        // Group BirthDate by year
        if (args.GroupedBy.Name == AttributeNames.Person.BirthDate)
            args.GroupConvertor = date => date[^4..];

        base.GetGroupingInfo(source, args);
    }
}