using Vidyano.Core.Extensions;
using Vidyano.Service.Repository;

namespace Dev.Service.AttributeActions;

public partial class DropDownActions : DefaultPersistentObjectActions<DevContext, DropDownActions.DropDown>
{
    public DropDownActions(DevContext context)
        : base(context)
    {
    }

    protected override DropDown LoadEntity(PersistentObject obj, bool forRefresh = false)
    {
        return DropDown.Static;
    }

    public override void OnLoad(PersistentObject obj, PersistentObject parent)
    {
        base.OnLoad(obj, parent);

        obj.Attributes.Run(a =>
        {
            a.Options = new[] { "Cat", "Dog", "Ball", "Rain", "Moon", "Movie" };
        });
    }

    public class DropDown
    {
        static DropDown instance;

        public static DropDown Static => instance ??= new DropDown
        {
            Default = "Dog",
            RadioVertical = "Dog",
            RadioHorizontal = "Dog",
            ChipVertical = "Dog",
            ChipHorizontal = "Dog",
        };

        public string Default { get; set; }

        public string RadioVertical { get; set; }

        public string RadioHorizontal { get; set; }

        public string ChipVertical { get; set; }

        public string ChipHorizontal { get; set; }
    }
}