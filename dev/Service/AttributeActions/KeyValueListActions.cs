using Vidyano.Core.Extensions;
using Vidyano.Service.Repository;

namespace Dev.Service.AttributeActions;

public partial class KeyValueListActions : DefaultPersistentObjectActions<DevContext, KeyValueListActions.KeyValueList>
{
    public KeyValueListActions(DevContext context)
        : base(context)
    {
    }

    protected override KeyValueList LoadEntity(PersistentObject obj, bool forRefresh = false)
    {
        return KeyValueList.Static;
    }

    public override void OnLoad(PersistentObject obj, PersistentObject parent)
    {
        base.OnLoad(obj, parent);

        obj.Attributes.Run(a =>
        {
            a.Options = new[] { "0=Cat", "1=Dog", "2=Ball", "3=Rain", "4=Moon", "5=Movie" };
        });
    }

    public class KeyValueList
    {
        static KeyValueList instance;

        public static KeyValueList Static => instance ??= new KeyValueList
        {
            Default = 1,
            RadioVertical = 1,
            RadioHorizontal = 1,
            ChipVertical = 1,
            ChipHorizontal = 1,
        };

        public int Default { get; set; }

        public int RadioVertical { get; set; }

        public int RadioHorizontal { get; set; }

        public int ChipVertical { get; set; }

        public int ChipHorizontal { get; set; }
    }
}