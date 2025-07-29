using Vidyano.Service.Repository;

namespace Dev.Service.CustomActions;

public partial class Feature_StartWizard : CustomAction<DevContext>
{
    public override PersistentObject? Execute(CustomActionArgs e)
    {
        return Manager.Current.GetPersistentObject("Dev.Feature_Wizard", string.Empty);
    }
}