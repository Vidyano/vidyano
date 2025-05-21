using Newtonsoft.Json.Linq;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Threading.Tasks;
using Vidyano.Service;
using Vidyano.Service.Repository;

namespace Dev.Service.Model
{
    public class Attributes
    {
        private static readonly Dictionary<string, Attributes> instances = new Dictionary<string, Attributes>();
        private static readonly byte[] image = Convert.FromBase64String("iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAmAAAAJgBosiCmAAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAI2SURBVFiFvZe/a1NRFMc/pwYxdhHBURwc6iaIf4A4WAQ3FSflJdYMioNIXYuzrYqFKioJjaUUBMWluKmDONjFRURBiYv4oxqk1RKT93VoqjHem/fy8tIDGe753nO+n+Tm3vueSSLNsLu2kWU2O8UK3zWmsDU1kKo7wBIziG+OzwuXX6oANm07gcMe+arGVO8rACHnPT2r/OSWqyQ1ACvZNiBwi9zQaS31FQDjLJB1KDVqXPOVpQJgd2wQccYjz6igD30FoMEIsNWhCJjoVNozgF20DOKcW2ReOb3sKwDbOQbscGriUlR57wDGqEd5rpyeRJVnnD1LdgRxACMLbMLIIrJARTnlW+YNA7s9YJHf3guA8QU49Wf897oIrWyjOqHF5viCp+9bBrkXB8C5BAr0GHjlnN/gIIAVbS+w39lVXNZRNRIDNOO6J38I6LT2i9QpxTHvDGCUgR8OZdiKNoTv0jGmVJCrrjsABaoCcw5pC8YssMGhrSAm45p3BFil8C7DHk9+Wjl9Tg1AeS0ACzF7hVjnY7drAADM+yu0xwMFepM+QI05oBo5L8axmwig+Y8uR5g/VV7P+gIARC/DAONJzAEs7mO5lewRsO8/Qbwmzy6R7Pk+/m3o25LGRFLz7gDq3Ac+tmU/NU/MxBEbQAX9Am63pScVaGVdAADIcBNYe7VaJmSqF/OuAXRc74H51QFFndTXdQUA1rZkg5ArvZonA6jwEBjXiN6lARD7HPinCLNetl5r/AankcH9UZDjdgAAAABJRU5ErkJggg==");

        internal static Attributes GetInstance(DevContext context)
        {
            var ip = Manager.Current.RequestMessage.GetClientIpAddress();
            Attributes instance;

            lock (instances)
            if (!instances.TryGetValue(ip, out instance))
            {
                instance = new Attributes
                {
                    Boolean = true,
                    YesNo = true,
                    String = "Test",
                    StringLower = "test",
                    StringUpper = "TEST",
                    MultiLineString = "Test line 1\nTest line 2",
                    MultiString = "Test line 1\nTest line 2",
                    MultiStringWithTags = "red\ngreen\nblue",
                    Password = "S3cr3T",
                    Byte = 128,
                    Decimal = 1234567890123.456789M,
                    Double = 1234567890123.456789,
                    Single = 123456.7F,
                    Int16 = Int16.MinValue,
                    Int32 = Int32.MinValue,
                    Int64 = -1234567890123456789,
                    SByte = 127,
                    UInt16 = UInt16.MaxValue,
                    UInt32 = UInt32.MaxValue,
                    UInt64 = 1234567890123456789,
                    KeyValueList = 1,
                    ComboBox = "Bla",
                    DropDown = "B",
                    Date = DateTime.Today,
                    DateTime = DateTime.Now,
                    DateTimeOffset = DateTimeOffset.Now,
                    Guid = Guid.NewGuid(),
                    Time = DateTime.Now.TimeOfDay,
                    Reference = context.Employees.First(),
                    ReferenceWithCanAddNew = context.Employees.First(),
                    ReferenceWithSelectInPlace = context.Employees.First(),
                    AsDetail = context.Employees.OrderBy(c => c.FirstName).Take(3).ToList(),
                    AsDetailReadOnly = context.Employees.OrderBy(c => c.FirstName).Take(2).ToList(),
                    BinaryFile = "Vidyano.png|iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAmAAAAJgBosiCmAAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAI2SURBVFiFvZe/a1NRFMc/pwYxdhHBURwc6iaIf4A4WAQ3FSflJdYMioNIXYuzrYqFKioJjaUUBMWluKmDONjFRURBiYv4oxqk1RKT93VoqjHem/fy8tIDGe753nO+n+Tm3vueSSLNsLu2kWU2O8UK3zWmsDU1kKo7wBIziG+OzwuXX6oANm07gcMe+arGVO8rACHnPT2r/OSWqyQ1ACvZNiBwi9zQaS31FQDjLJB1KDVqXPOVpQJgd2wQccYjz6igD30FoMEIsNWhCJjoVNozgF20DOKcW2ReOb3sKwDbOQbscGriUlR57wDGqEd5rpyeRJVnnD1LdgRxACMLbMLIIrJARTnlW+YNA7s9YJHf3guA8QU49Wf897oIrWyjOqHF5viCp+9bBrkXB8C5BAr0GHjlnN/gIIAVbS+w39lVXNZRNRIDNOO6J38I6LT2i9QpxTHvDGCUgR8OZdiKNoTv0jGmVJCrrjsABaoCcw5pC8YssMGhrSAm45p3BFil8C7DHk9+Wjl9Tg1AeS0ACzF7hVjnY7drAADM+yu0xwMFepM+QI05oBo5L8axmwig+Y8uR5g/VV7P+gIARC/DAONJzAEs7mO5lewRsO8/Qbwmzy6R7Pk+/m3o25LGRFLz7gDq3Ac+tmU/NU/MxBEbQAX9Am63pScVaGVdAADIcBNYe7VaJmSqF/OuAXRc74H51QFFndTXdQUA1rZkg5ArvZonA6jwEBjXiN6lARD7HPinCLNetl5r/AankcH9UZDjdgAAAABJRU5ErkJggg==",
                    Enum = DateTime.Today.DayOfWeek,
                    TranslatedString = "{\"en\":\"English\",\"nl\":\"Nederlands\"}",
                    User = Manager.Current.User.Id,
                    Group = Manager.Current.GetGroup("Administrators").Id,
                    CommonMark = "**Hello world!**",
                    EnumFlags = AttributeVisibility.New | AttributeVisibility.Read,
                    Image = image,
                    TriggersRefresh = "Show all attributes",
                };

                instances[ip] = instance;
            }

            return instance;
        }

        public bool Boolean { get; set; }

        public bool? NullableBoolean { get; set; }

        public bool YesNo { get; set; }

        public string String { get; set; }

        public string StringUpper { get; set; }

        public string StringLower { get; set; }

        public string MultiLineString { get; set; }

        public string MultiString { get; set; }

        public string MultiStringWithTags { get; set; }

        public string Password { get; set; }

        public byte Byte { get; set; }

        public decimal Decimal { get; set; }

        public double Double { get; set; }

        public Single Single { get; set; }

        public Int16 Int16 { get; set; }

        public Int32 Int32 { get; set; }

        public Int64 Int64 { get; set; }

        public sbyte SByte { get; set; }

        public UInt16 UInt16 { get; set; }

        public UInt32 UInt32 { get; set; }

        public UInt64 UInt64 { get; set; }

        public byte? NullableByte { get; set; }

        public decimal? NullableDecimal { get; set; }

        public double? NullableDouble { get; set; }

        public Single? NullableSingle { get; set; }

        public Int16? NullableInt16 { get; set; }

        public Int32? NullableInt32 { get; set; }

        public Int64? NullableInt64 { get; set; }

        public sbyte? NullableSByte { get; set; }

        public UInt16? NullableUInt16 { get; set; }

        public UInt32? NullableUInt32 { get; set; }

        public UInt64? NullableUInt64 { get; set; }

        public int KeyValueList { get; set; }

        public string ComboBox { get; set; }

        public string DropDown { get; set; }

        public DateTime Date { get; set; }

        public DateTime DateTime { get; set; }

        public DateTimeOffset DateTimeOffset { get; set; }

        public TimeSpan Time { get; set; }

        public DateTime? NullableDate { get; set; }

        public DateTime? NullableDateTime { get; set; }

        public DateTimeOffset? NullableDateTimeOffset { get; set; }

        public TimeSpan? NullableTime { get; set; }

        public Guid Guid { get; set; }

        public Employee Reference { get; set; }

        public Employee ReferenceWithCanAddNew { get; set; }

        public Employee ReferenceWithSelectInPlace { get; set; }

        public ICollection<Employee> AsDetail { get; set; }

        public ICollection<Employee> AsDetailReadOnly { get; set; }

        public string BinaryFile { get; set; }

        public DayOfWeek Enum { get; set; }

        public AttributeVisibility EnumFlags { get; set; }

        public string TranslatedString { get; set; }

        public Guid User { get; set; }

        public Guid Group { get; set; }

        public Guid? NullableUser { get; set; }

        public string CommonMark { get; set; }

        public byte[] Image { get; set; }

        public string TriggersRefresh { get; set; }

        public string TriggersRefreshNullable { get; set; }

    }
}