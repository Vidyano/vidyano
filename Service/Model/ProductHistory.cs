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
    public class ProductHistory
    {
        public string Property { get; set; } = null!;

        public string? OldValue { get; set; }

        public string? NewValue { get; set; }
    }
}