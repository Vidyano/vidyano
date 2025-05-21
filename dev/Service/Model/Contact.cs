using Newtonsoft.Json.Linq;
using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.ComponentModel.DataAnnotations;
using System.Globalization;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Vidyano.Service.Repository;

namespace Dev.Service.Model
{
    [ValueObject]
    public class Contact : IComparable<Contact>
    {
        public static readonly string[] DisplayProperties =
        {
            nameof(Name),
            nameof(Title),
        };

        public string Name { get; set; } = null!;
        public string Title { get; set; } = null!;

        public int CompareTo(Contact? other)
        {
            return string.Compare(ToString(), other?.ToString(), StringComparison.Ordinal);
        }

        public override string ToString()
        {
            return $"{Name} ({Title})";
        }

        private sealed class ContactConverter : TypeConverter
        {
            public override bool CanConvertFrom(ITypeDescriptorContext? context, Type sourceType)
            {
                if (sourceType == typeof(string))
                    return true;

                return base.CanConvertFrom(context, sourceType);
            }

            public override object? ConvertFrom(ITypeDescriptorContext? context, CultureInfo? culture, object value)
            {
                if (value is string str)
                {
                    var match = Regex.Match(str, "(.+?) \\((.+?)\\)");
                    if (match.Success)
                        return new Contact { Name = match.Groups[1].Value, Title = match.Groups[2].Value };
                }

                return base.ConvertFrom(context, culture, value);
            }

            public override bool CanConvertTo(ITypeDescriptorContext? context, Type? destinationType)
            {
                if (destinationType == typeof(string))
                    return true;

                return base.CanConvertTo(context, destinationType);
            }

            public override object? ConvertTo(ITypeDescriptorContext? context, CultureInfo? culture, object? value, Type destinationType)
            {
                return base.ConvertTo(context, culture, value, destinationType);
            }
        }
    }
}