using System;
using System.Collections.Generic;
using System.Linq.Expressions;
using Vidyano.Core.Extensions;
using Vidyano.Service.Repository;
using VidyanoWeb3.Service.Model;

namespace VidyanoWeb3.Service
{
    public sealed class AttributesActions : PersistentObjectActionsReference<VidyanoWeb3Context, Attributes>
    {
        public AttributesActions(VidyanoWeb3Context context)
            : base(context)
        {
        }

        public override void OnLoad(PersistentObject obj, PersistentObject parent)
        {
            base.OnLoad(obj, parent);

            if (obj.ObjectId == "sensitive") {
                obj.Attributes.Run(a => {
                    a.IsSensitive = true;
                });
            }

            obj.Attributes.Run(attr => attr.Actions = new[] { "Test" });
        }

        protected override Attributes LoadEntity(PersistentObject obj, bool forRefresh = false)
        {
            return Attributes.GetInstance(Context);
        }

        public override void OnRefresh(RefreshArgs args)
        {
            var obj = args.PersistentObject;
            if (args.Attribute.Name == "TriggersRefresh")
            {
                switch ((string)args.Attribute)
                {
                    case "Show all attributes":
                        obj.Attributes.Run(a => a.Visibility = AttributeVisibility.Always);
                        break;

                    case "Hide tab Advanced":
                        obj.Attributes.Run(a => a.Visibility = a.TabName == "Advanced" ? AttributeVisibility.Never : AttributeVisibility.Always);
                        break;

                    case "Hide group Nullable":
                        obj.Attributes.Run(a => a.Visibility = a.GroupName == "Nullable" ? AttributeVisibility.Never : AttributeVisibility.Always);
                        break;
                }
            }
            else if (args.Attribute.Name == "NullableBooleanTypeHints")
                obj["CustomersReadOnly"].IsReadOnly = (bool?)args.Attribute ?? false;
        }

    }

    partial class VidyanoWeb3Context
    {
        public IEnumerable<Employee> EmployeesAsDetail(CustomQueryArgs e)
        {
            return Attributes.GetInstance(this).AsDetail;
        }
    }
}