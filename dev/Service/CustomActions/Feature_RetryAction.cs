using Vidyano.Service.Repository;

namespace Dev.Service.CustomActions;

public partial class Feature_RetryAction : CustomAction<DevContext>
{
    public override PersistentObject? Execute(CustomActionArgs e)
    {
        var options = new[] { "Yes, I'm sure", "No, not so sure" };

        if (Manager.Current.RetryResult == null)
            Manager.Current.RetryAction("Are you sure?", "Fill in the form below:", Manager.Current.GetPersistentObject(PersistentObjectTypes.Dev.Feature_RetryAction, isNew: true, targetContext: Context), options, 0, 1);
        else if (Manager.Current.RetryResult.Option == options[0])
            return Manager.Current.GetNotification("Well done!", NotificationType.OK);
        else if (Manager.Current.RetryResult.Option == options[1])
            return Manager.Current.GetNotification("Not so sure it is.", NotificationType.Warning);

        return null;
    }
}