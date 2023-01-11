using Newtonsoft.Json.Linq;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Threading.Tasks;
using Vidyano.Service.Repository;

namespace VidyanoWeb3.Service.Model
{
    [ValueObject]
    public class OrderLine
    {
        [Reference(typeof(Product))]
        public string Product { get; set; } = null!;

        public string ProductName { get; set; } = null!;

        public decimal PricePerUnit { get; set; }

        public int Quantity { get; set; }

        public decimal Discount { get; set; }

        [Reference(typeof(Order))]
        public string? RelatedOrder { get; set; }
    }
}