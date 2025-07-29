using Vidyano.Service.Repository;

namespace Dev.Service.CustomActions;

public partial class ResetTest : CustomAction<DevContext>
{
    public override PersistentObject? Execute(CustomActionArgs e)
    {
        DevContext.Initialize();

        if (e.Parent != null)
            return Manager.Current.GetPersistentObject(e.Parent.FullTypeName, e.Parent.ObjectId ?? string.Empty);

        return null;
    }
}