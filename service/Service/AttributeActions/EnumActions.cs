using System;
using Vidyano.Service.Repository;

namespace VidyanoWeb3.Service.AttributeActions;

public partial class EnumActions : DefaultPersistentObjectActions<VidyanoWeb3Context, EnumActions.Enum>
{
    public EnumActions(VidyanoWeb3Context context)
        : base(context)
    {
    }

    protected override Enum LoadEntity(PersistentObject obj, bool forRefresh = false)
    {
        return Enum.Static;
    }

    public class Enum
    {
        static Enum instance;

        public static Enum Static => instance ??= new Enum
        {
            Default = DateTime.Today.DayOfWeek,
            Flags = AttributeVisibility.New | AttributeVisibility.Read,
            RadioVertical = DateTime.Today.DayOfWeek,
            RadioHorizontal = DateTime.Today.DayOfWeek,
            ChipVertical = DateTime.Today.DayOfWeek,
            ChipHorizontal = DateTime.Today.DayOfWeek,
        };

        public DayOfWeek Default { get; set; }

        public AttributeVisibility Flags { get; set; }

        public DayOfWeek RadioVertical { get; set; }

        public DayOfWeek RadioHorizontal { get; set; }

        public DayOfWeek ChipVertical { get; set; }

        public DayOfWeek ChipHorizontal { get; set; }
    }
}