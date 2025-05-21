using Newtonsoft.Json.Linq;
using Raven.Client.Documents.Indexes;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Threading.Tasks;
using Vidyano.Service.Repository;

namespace Dev.Service.Model
{
    public class Shipper
    {
        public string Id { get; set; }

        public string Name { get; set; }

        public string Phone { get; set; }
    }
}