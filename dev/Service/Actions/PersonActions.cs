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
}