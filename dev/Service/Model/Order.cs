using Newtonsoft.Json.Linq;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Threading.Tasks;
using Vidyano.Service.Repository;

namespace Dev.Service.Model
{
    public class Order
    {
        public string Id { get; set; } = null!;

        [Reference(typeof(Company))]
        public string Company { get; set; } = null!;

        [Reference(typeof(Employee))]
        public string Employee { get; set; } = null!;

        public DateTime OrderedAt { get; set; }

        public DateTime RequireAt { get; set; }

        public DateTime? ShippedAt { get; set; }

        [Reference(typeof(Shipper))]
        public string ShipVia { get; set; } = null!;

        public decimal Freight { get; set; }

        public List<OrderLine> Lines { get; set; } = new();
    }
}