using Newtonsoft.Json.Linq;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Threading.Tasks;
using Vidyano.Service.Repository;

namespace VidyanoWeb3.Service.Model
{
    public class Order
    {
        public string Id { get; set; }

        [Reference(typeof(Company))]
        public string Company { get; set; }

        [Reference(typeof(Employee))]
        public string Employee { get; set; }

        [Required]
        public decimal Freight { get; set; }
    }
}