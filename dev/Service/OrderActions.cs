using System;
using System.Collections.Generic;
using System.Linq;
using System.Linq.Expressions;
using Vidyano.Core.Extensions;
using Vidyano.Service.Repository;
using Dev.Service.Model;

namespace Dev.Service
{
    public sealed class OrderActions : PersistentObjectActionsReference<DevContext, Order>
    {
        public OrderActions(DevContext context)
            : base(context)
        {
        }

        public override void OnLoad(PersistentObject obj, PersistentObject? parent)
        {
            base.OnLoad(obj, parent);

            obj.Advanced.ForceFromAction = true;
        }

        protected override void GetTotalItem(Source<Order> source, TotalItemArgs args)
        {
            args.SetValue(nameof(Order.Freight), source.AsEnumerable().Sum(o => o.Freight));
        }
    }
}