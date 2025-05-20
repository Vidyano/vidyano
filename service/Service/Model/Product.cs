using Newtonsoft.Json.Linq;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Threading.Tasks;
using Vidyano.Service.Repository;

namespace VidyanoWeb3.Service.Model
{
    public class Product
    {
        public string Id { get; set; } = null!;

        public string Name { get; set; } = null!;

        [Reference(typeof(Supplier))]
        public string Supplier { get; set; } = null!;

        [Reference(typeof(Category))]
        public string Category { get; set; } = null!;

        public string QuantityPerUnit { get; set; } = null!;

        public decimal PricePerUnit { get; set; }

        public int UnitsInStock { get; set; }

        public int UnitsOnOrder { get; set; }

        public bool Discontinued { get; set; }

        public int ReorderLevel { get; set; }

        public List<ProductHistory> History { get; set; } = new();
    }
}