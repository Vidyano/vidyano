using Vidyano.Service.Repository;

namespace Dev.Service.CustomActions;

public partial class NewPersonWizard : CustomAction<DevContext>
{
    public override PersistentObject? Execute(CustomActionArgs e)
    {
        return Manager.Current.GetPersistentObject(PersistentObjectTypes.Dev.NewPersonWizard, isNew: true);
    }
}