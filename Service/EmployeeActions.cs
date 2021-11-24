using System;
using System.Linq;
using System.Linq.Expressions;
using Vidyano.Service.Repository;
using VidyanoWeb3.Service.Model;

namespace VidyanoWeb3.Service
{
    public sealed class EmployeeActions : PersistentObjectActionsReference<VidyanoWeb3Context, Employee>
    {
        public EmployeeActions(VidyanoWeb3Context context)
            : base(context)
        {
        }

        public override void OnConstruct(Query query, PersistentObject parent)
        {
            base.OnConstruct(query, parent);

            if (!query.Name.StartsWith("QueryGridTest_Flags_"))
                return;

            var flags = query.Name.Substring("QueryGridTest_Flags_".Length).Split("_");
            switch (flags[0])
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

            if (flags.Length > 1 && flags[1] == "Grouping")
                query.GroupedBy = "Title";

            query.IsIncludedInParentObject = true;
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