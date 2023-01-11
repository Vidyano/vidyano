using Newtonsoft.Json.Linq;
using Raven.Client.Documents.Indexes;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Threading.Tasks;
using Vidyano.Service.Repository;
using VidyanoWeb3.Service;
using VidyanoWeb3.Service.Model;

namespace VidyanoWeb3.Service.Indexes
{
    public class VOrder
    {
        public string? CompanyName { get; set; }

        [IgnoreProperty]
        public string? CompanyNameSort { get; set; }

        public DateTime OrderedAt { get; set; }

        public DateTime MonthOrderedAt { get; set; }

        public decimal SubTotal { get; set; }

        public decimal Discount { get; set; }

        public double Total { get; set; }

        public string? ShipVia { get; set; }
    }

    public class Orders_Overview : AbstractIndexCreationTask<Order>
    {
        public Orders_Overview()
        {
            Map = orders =>
                from order in orders
                let company = LoadDocument<Company>(order.Company)
                let shipper = LoadDocument<Shipper>(order.ShipVia)
                select new VOrder
                {
                    
                    CompanyName = company.Name,
                    CompanyNameSort = company.Name,
                    OrderedAt = order.OrderedAt,
                    MonthOrderedAt = new(order.OrderedAt.Year, order.OrderedAt.Month, 1),
                    SubTotal = order.Lines.Sum(l => l.PricePerUnit * l.Quantity),
                    Discount = order.Lines.Sum(l => l.PricePerUnit * l.Quantity * l.Discount),
                    Total = (double)order.Lines.Sum(l => l.PricePerUnit * l.Quantity * (1 - l.Discount)),
                    ShipVia = shipper.Name
                };

            Index(nameof(VOrder.CompanyName), FieldIndexing.Search);

            StoreAllFields(FieldStorage.Yes);
        }
    }
}