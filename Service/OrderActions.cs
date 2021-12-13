using System;
using System.Collections.Generic;
using System.Linq;
using System.Linq.Expressions;
using Vidyano.Core.Extensions;
using Vidyano.Service.Repository;
using VidyanoWeb3.Service.Model;

namespace VidyanoWeb3.Service
{
    public sealed class OrderActions : PersistentObjectActionsReference<VidyanoWeb3Context, Order>
    {
        public OrderActions(VidyanoWeb3Context context)
            : base(context)
        {
        }

        protected override void GetTotalItem(Source<Order> source, TotalItemArgs args)
        {
            args.SetValue(nameof(Order.Freight), source.AsEnumerable().Sum(o => o.Freight));
        }
    }
}