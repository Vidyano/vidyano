using Vidyano.Service;
using Vidyano.Service.Repository;

namespace Dev.Service.CustomActions;

public partial class TestOptions : CustomAction<DevContext>
{
    public override PersistentObject? Execute(CustomActionArgs e)
    {
        if (e.Parameters == null || e.Parameters.Count == 0)
            throw new FaultException("Option is required");

        e.EnsureQuery();

        var json = System.Text.Json.JsonSerializer.Serialize(e.Parameters);
        e.Query.AddNotification(json, NotificationType.OK);

        return null;
    }
}