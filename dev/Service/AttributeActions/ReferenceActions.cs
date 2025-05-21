using System.Linq;
using Vidyano.Service.Repository;
using Dev.Service.Model;

namespace Dev.Service.AttributeActions;

public partial class ReferenceActions : DefaultPersistentObjectActions<DevContext, ReferenceActions.Reference>
{
    public ReferenceActions(DevContext context)
        : base(context)
    {
    }

    protected override Reference LoadEntity(PersistentObject obj, bool forRefresh = false)
    {
        return Reference.Static(Context);
    }

    public class Reference
    {
        static Reference instance;

        public static Reference Static(DevContext context)
        {
            return instance ??= new Reference(context);
        }

        Reference(DevContext context)
        {
            var employee = context.Employees.First();

            Default = employee;
            Required = employee;
            SelectInPlace = employee;
            SelectInPlaceRequired = employee;
            SelectInPlaceCanAddNew = employee;
            SelectInPlaceCanAddNewRequired = employee;
            CanAddNew = employee;
            RadioVertical = employee;
            RadioHorizontal = employee;
            ChipVertical = employee;
            ChipHorizontal = employee;
        }

        public Employee Default { get; set; }

        public Employee Required { get; set; }

        public Employee SelectInPlace { get; set; }

        public Employee SelectInPlaceRequired { get; set; }

        public Employee SelectInPlaceCanAddNew { get; set; }

        public Employee SelectInPlaceCanAddNewRequired { get; set; }

        public Employee CanAddNew { get; set; }
        
        public Employee RadioVertical { get; set; }

        public Employee RadioHorizontal { get; set; }

        public Employee ChipVertical { get; set; }

        public Employee ChipHorizontal { get; set; }
    }
}