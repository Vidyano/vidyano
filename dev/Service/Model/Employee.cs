using Newtonsoft.Json.Linq;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Threading.Tasks;
using Vidyano.Service.Repository;

namespace Dev.Service.Model
{
    public class Employee
    {
        public string Id { get; set; }

        [Required]
        public string LastName { get; set; }

        [Required]
        public string FirstName { get; set; }

        [Required]
        public string Title { get; set; }

        public DateTime HiredAt { get; set; }

        public DateTime Birthday { get; set; }

        [Required]
        public string HomePhone { get; set; }

        [Required]
        public string Extension { get; set; }

        [Reference(typeof(Employee))]
        public string ReportsTo { get; set; }

        [Required]
        public List<string> Notes { get; set; }

        [Required]
        public List<string> Territories { get; set; }
    }
}