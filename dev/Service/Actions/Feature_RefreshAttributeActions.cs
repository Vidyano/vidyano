using Dev.Service.Model;
using Vidyano.Core.Extensions;
using Vidyano.Service;
using Vidyano.Service.ClientOperations;
using Vidyano.Service.Repository;

namespace Dev.Service.Actions;

public partial class Feature_RefreshAttributeActions
{
    public override void OnNew(PersistentObject obj, PersistentObject? parent, Query? query, Dictionary<string, string>? parameters)
    {
        base.OnNew(obj, parent, query, parameters);

        obj[AttributeNames.Feature_RefreshAttribute.TranslatedString].SetOriginalValue(new TranslatedString
        {
            [Languages.English] = "English",
            [Languages.Dutch] = "Nederlands"
        });
    }

    public override void OnRefresh(RefreshArgs args)
    {
        if (args.Attribute.Name == AttributeNames.Feature_RefreshAttribute.FirstName ||
            args.Attribute.Name == AttributeNames.Feature_RefreshAttribute.LastName)
        {
            var firstName = (string?)args.PersistentObject[AttributeNames.Feature_RefreshAttribute.FirstName];
            var lastName = (string?)args.PersistentObject[AttributeNames.Feature_RefreshAttribute.LastName];

            Task.Delay(1_000).Wait(); // Simulate some processing time...

            args.PersistentObject[AttributeNames.Feature_RefreshAttribute.FullName] = $"{firstName} {lastName}".Trim();

            args.PersistentObject[AttributeNames.Feature_RefreshAttribute.TranslatedString].SetChangedValue(new TranslatedString
            {
                [Languages.English] = "English",
                [Languages.Dutch] = "Nederlands + " + DateTime.Now.ToString("T")
            });
        }
    }
    
    public override void OnSave(PersistentObject obj)
    {
        Task.Delay(1_000).Wait(); // Simulate some processing time...

        base.OnSave(obj);
    }
}