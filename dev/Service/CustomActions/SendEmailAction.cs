using Dev.Service.Model;
using Vidyano.Service.Repository;

namespace Dev.Service.CustomActions;

public partial class SendEmail: CustomAction<DevContext>
{
    public override PersistentObject? Execute(CustomActionArgs e)
    {
        e.EnsureParent(PersistentObjectTypes.Dev.Person);

        if (e.Parent.Attributes.Any(a => a.IsValueChanged))
        {
            e.Parent.AddNotification("Person has been modified, please save before sending an email.", NotificationType.Error);
            return null;
        }

        var preference = (ContactPreference)Enum.Parse(typeof(ContactPreference), (string)e.Parent[AttributeNames.Person.ContactPreference]!);
        if (preference != ContactPreference.Email)
        {
            e.Parent.AddNotification("You can only send an email to a person with Email contact preference.", NotificationType.Error);
            return null;
        }

        var emailObject = Manager.Current.GetPersistentObject(PersistentObjectTypes.Dev.Email);
        if (emailObject == null)
        {
            e.Parent.AddNotification("Unable to create email object.", NotificationType.Error);
            return null;
        }

        emailObject.Tag = e.Parent.ObjectId;

        return emailObject;
    }
}