using Newtonsoft.Json.Linq;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Threading.Tasks;
using Vidyano.Service.Repository;

namespace VidyanoWeb3.Service.Model
{
    public class Company
    {
        public string Id { get; set; }

        [Required]
        public string Name { get; set; }

        [Required]
        public string ExternalId { get; set; }

        [Required]
        public string Phone { get; set; }

        [Required]
        public string Fax { get; set; }
    }
}