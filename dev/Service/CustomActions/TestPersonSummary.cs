using Vidyano.Service.Repository;

namespace Dev.Service.CustomActions;

public partial class TestPersonSummary : CustomAction<DevContext>
{
    public override PersistentObject? Execute(CustomActionArgs e)
    {
        e.EnsureParent(Types.Person);

        var result = string.Join("\n",
            e.Parent.Attributes.OrderBy(a => a.Offset)
            .Select(a => $"{a.Name}: {(string?)e.Parent[a.Name] ?? "null"}"));

        return Notification(result, NotificationType.OK, asDialog: true);
    }
}