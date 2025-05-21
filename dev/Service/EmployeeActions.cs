using System;
using System.Collections.Generic;
using System.Linq;
using System.Linq.Expressions;
using Vidyano.Core.Extensions;
using Vidyano.Service.Repository;
using Dev.Service.Model;

namespace Dev.Service
{
    public sealed class EmployeeActions : PersistentObjectActionsReference<DevContext, Employee>
    {
        public EmployeeActions(DevContext context)
            : base(context)
        {
        }

        public override void OnConstruct(Query query, PersistentObject parent)
        {
            base.OnConstruct(query, parent);

            if (!query.Name.StartsWith("QueryGridTest_Flags_"))
                return;

            switch (query.Name.Substring("QueryGridTest_Flags_".Length))
            {
                case "None":
                    query.Actions = null;
                    break;

                case "Select":
                    query.Actions = query.Actions.Where(a => a == "Merge").ToArray();
                    break;

                case "Filter":
                    query.Actions = query.Actions.Where(a => a == "Filter").ToArray();
                    break;

                case "InlineActions":
                    query.Actions = query.Actions.Where(a => a == "BulkEdit").ToArray();
                    break;

                case "SelectAndFilter":
                    query.Actions = query.Actions.Where(a => a == "Merge" || a == "Filter").ToArray();
                    break;

                case "SelectAndInlineActions":
                    query.Actions = query.Actions.Where(a => a != "Filter").ToArray();
                    break;
            }

            if (!string.IsNullOrEmpty(parent.ObjectId))
                query.GroupedBy = "Title";

            query.IsIncludedInParentObject = true;
        }

        public override void OnLoad(PersistentObject obj, PersistentObject parent)
        {
            base.OnLoad(obj, parent);

            if (parent?.FullTypeName == "Dev.Attributes" && parent.ObjectId == "sensitive")
            {
                obj.Attributes.Run(a => {
                    a.IsSensitive = true;
                });
            }
        }

        protected override void GetGroupingInfo(Source<Employee> source, GroupingInfoArgs args)
        {
            args.SetResult(source.OrderBy(e => e.Title).AsQueryable().ToArray()
                .GroupBy(h => h.Title)
                .Select(g => new
                {
                    g.Key,
                    Count = g.Count()
                })
                .Select(g => new GroupInfo
                {
                    Name = $"{g.Key}",
                    Count = g.Count
                })
                .ToArray());
        }
    }
}