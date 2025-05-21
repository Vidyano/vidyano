using Newtonsoft.Json.Linq;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Threading.Tasks;
using Vidyano.Service.Repository;

namespace Dev.Service.Model
{
    public class Supplier
    {
        public string Id { get; set; } = null!;

        public Contact Contact { get; set; } = null!;

        public string Name { get; set; } = null!;

        public Address Address { get; set; } = null!;

        public string Phone { get; set; } = null!;

        public string? Fax { get; set; }

        public string? HomePage { get; set; }
    }
}