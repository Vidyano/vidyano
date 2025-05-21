using Newtonsoft.Json.Linq;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Threading.Tasks;
using Vidyano.Service.Repository;

namespace Dev.Service.Model
{
    [ValueObject]
    public class Address : IComparable<Address>
    {
        public static readonly string[] DisplayProperties =
        {
            nameof(Line1),
            nameof(PostalCode),
            nameof(City),
            nameof(Country),
        };

        public string Line1 { get; set; } = null!;
        public string? Line2 { get; set; }
        public string City { get; set; } = null!;
        public string? Region { get; set; }
        public string PostalCode { get; set; } = null!;
        public string Country { get; set; } = null!;

        public int CompareTo(Address? other)
        {
            return string.Compare(ToString(), other?.ToString(), StringComparison.Ordinal);
        }

        public override string ToString()
        {
            return $"{Line1}\n{PostalCode} {City}\n{Country}";
        }
    }
}