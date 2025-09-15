using Vidyano.Service.Repository;

namespace Dev.Service.CustomActions;

public partial class TestDownload : CustomAction<DevContext>
{
    public override PersistentObject? Execute(CustomActionArgs e)
    {
        e.EnsureQuery();

        return Manager.Current.RegisterStream(Manager.Current.GetPersistentObject(Types.Person)!, string.Join(", ", e.SelectedItems.Select(po => po.Id)));
    }
}