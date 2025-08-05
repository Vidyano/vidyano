using Vidyano.Service.ClientOperations;
using Vidyano.Service.Repository;

namespace Dev.Service.Actions;

public partial class NewPersonWizardActions
{
    public override void OnSave(PersistentObject obj)
    {
        if (CheckRules(obj))
        {
            var newPerson = Manager.Current.GetPersistentObject(PersistentObjectTypes.Dev.Person, isNew: true)!;
            newPerson.SetAttributeValue(AttributeNames.Person.FirstName, (string?)obj[AttributeNames.NewPersonWizard.FirstName]);
            newPerson.SetAttributeValue(AttributeNames.Person.LastName, (string?)obj[AttributeNames.NewPersonWizard.LastName]);

            Manager.Current.QueueClientOperation(new OpenOperation(newPerson));
        }
    }
}