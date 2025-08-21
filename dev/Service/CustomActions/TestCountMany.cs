using Vidyano.Service.Repository;

namespace Dev.Service.CustomActions;

public partial class TestCountMany : CustomAction<DevContext>
{
    public override PersistentObject? Execute(CustomActionArgs e)
    {
        e.EnsureQuery();

        e.Query.AddNotification(Convert.ToString(e.SelectedItems.Length), NotificationType.OK);

        return null;
    }
}