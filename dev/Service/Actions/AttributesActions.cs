using Vidyano.Service;
using Vidyano.Service.Repository;
using Dev.Service.Model;
using Vidyano.Service.Repository.Builder;
using Vidyano.Core.Extensions;

namespace Dev.Service.Actions;

public partial class AttributesActions
{
    static Tuple<Attributes, int> _cache = null!;
    static readonly byte[] image = Convert.FromBase64String("iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAmAAAAJgBosiCmAAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAI2SURBVFiFvZe/a1NRFMc/pwYxdhHBURwc6iaIf4A4WAQ3FSflJdYMioNIXYuzrYqFKioJjaUUBMWluKmDONjFRURBiYv4oxqk1RKT93VoqjHem/fy8tIDGe753nO+n+Tm3vueSSLNsLu2kWU2O8UK3zWmsDU1kKo7wBIziG+OzwuXX6oANm07gcMe+arGVO8rACHnPT2r/OSWqyQ1ACvZNiBwi9zQaS31FQDjLJB1KDVqXPOVpQJgd2wQccYjz6igD30FoMEIsNWhCJjoVNozgF20DOKcW2ReOb3sKwDbOQbscGriUlR57wDGqEd5rpyeRJVnnD1LdgRxACMLbMLIIrJARTnlW+YNA7s9YJHf3guA8QU49Wf897oIrWyjOqHF5viCp+9bBrkXB8C5BAr0GHjlnN/gIIAVbS+w39lVXNZRNRIDNOO6J38I6LT2i9QpxTHvDGCUgR8OZdiKNoTv0jGmVJCrrjsABaoCcw5pC8YssMGhrSAm45p3BFil8C7DHk9+Wjl9Tg1AeS0ACzF7hVjnY7drAADM+yu0xwMFepM+QI05oBo5L8axmwig+Y8uR5g/VV7P+gIARC/DAONJzAEs7mO5lewRsO8/Qbwmzy6R7Pk+/m3o25LGRFLz7gDq3Ac+tmU/NU/MxBEbQAX9Am63pScVaGVdAADIcBNYe7VaJmSqF/OuAXRc74H51QFFndTXdQUA1rZkg5ArvZonA6jwEBjXiN6lARD7HPinCLNetl5r/AankcH9UZDjdgAAAABJRU5ErkJggg==");

    public override void OnConstruct(PersistentObject obj)
    {
        base.OnConstruct(obj);

        // Variations of attributes

        List<PersistentObjectAttribute> chipAttributes = [];
        List<PersistentObjectAttribute> radioAttributes = [];

        chipAttributes.Add(obj.GetAttribute(AttributeNames.Attributes.KeyValueList).CloneAndAdd(obj, "KeyValueListAsChipVertical"));
        chipAttributes.Add(obj.GetAttribute(AttributeNames.Attributes.KeyValueList).CloneAndAdd(obj, "KeyValueListAsChipHorizontal"));
        radioAttributes.Add(obj.GetAttribute(AttributeNames.Attributes.KeyValueList).CloneAndAdd(obj, "KeyValueListAsRadioVertical"));
        radioAttributes.Add(obj.GetAttribute(AttributeNames.Attributes.KeyValueList).CloneAndAdd(obj, "KeyValueListAsRadioHorizontal"));

        chipAttributes.Add(obj.GetAttribute(AttributeNames.Attributes.DropDown).CloneAndAdd(obj, "DropDownAsChipVertical"));
        chipAttributes.Add(obj.GetAttribute(AttributeNames.Attributes.DropDown).CloneAndAdd(obj, "DropDownAsChipHorizontal"));
        radioAttributes.Add(obj.GetAttribute(AttributeNames.Attributes.DropDown).CloneAndAdd(obj, "DropDownAsRadioVertical"));
        radioAttributes.Add(obj.GetAttribute(AttributeNames.Attributes.DropDown).CloneAndAdd(obj, "DropDownAsRadioHorizontal"));

        chipAttributes.Add(obj.GetAttribute(AttributeNames.Attributes.Enum).CloneAndAdd(obj, "EnumAsChipVertical"));
        chipAttributes.Add(obj.GetAttribute(AttributeNames.Attributes.Enum).CloneAndAdd(obj, "EnumAsChipHorizontal"));
        radioAttributes.Add(obj.GetAttribute(AttributeNames.Attributes.Enum).CloneAndAdd(obj, "EnumAsRadioVertical"));
        radioAttributes.Add(obj.GetAttribute(AttributeNames.Attributes.Enum).CloneAndAdd(obj, "EnumAsRadioHorizontal"));

        chipAttributes.Add(obj.GetAttribute(AttributeNames.Attributes.Reference).CloneAndAdd(obj, "ReferenceAsChipVertical"));
        chipAttributes.Add(obj.GetAttribute(AttributeNames.Attributes.Reference).CloneAndAdd(obj, "ReferenceAsChipHorizontal"));
        radioAttributes.Add(obj.GetAttribute(AttributeNames.Attributes.Reference).CloneAndAdd(obj, "ReferenceAsRadioVertical"));
        radioAttributes.Add(obj.GetAttribute(AttributeNames.Attributes.Reference).CloneAndAdd(obj, "ReferenceAsRadioHorizontal"));

        chipAttributes.Run(attr =>
        {
            attr.GroupName = "Chip";
            attr.AddTypeHint("inputtype", "chip");

            if (attr.Name.EndsWith("Vertical", StringComparison.Ordinal))
            {
                attr.AddTypeHint("orientation", "vertical");
                attr.Label = $"{attr.Label} as Chip Vertical";
            }
            else
            {
                attr.AddTypeHint("orientation", "horizontal");
                attr.Label = $"{attr.Label} as Chip Horizontal";
            }

            if (attr is PersistentObjectAttributeWithReference attrWRef)
                    attrWRef.SelectInPlace = true;
        });

        radioAttributes.Run(a =>
        {
            a.GroupName = "Radio";
            a.AddTypeHint("inputtype", "radio");

            if (a.Name.EndsWith("Vertical", StringComparison.Ordinal))
            {
                a.AddTypeHint("orientation", "vertical");
                a.Label = $"{a.Label} as Radio Vertical";
            }
            else
            {
                a.AddTypeHint("orientation", "horizontal");
                a.Label = $"{a.Label} as Radio Horizontal";
            }

            if (a is PersistentObjectAttributeWithReference attrWRef)
                attrWRef.SelectInPlace = true;
        });
    }

    protected override Attributes LoadEntity(PersistentObject obj, bool forRefresh = false)
    {
        if (_cache?.Item1 == null || _cache.Item2 < DevContext.Version)
        {
            _cache = new Tuple<Attributes, int>(
                new Attributes
                {
                    String = "Test",
                    MultiLineString = "Test line 1\nTest line 2",
                    MultiString = "Test line 1\nTest line 2",
                    MultiStringWithTags = "red\ngreen\nblue",
                    Password = "S3cr3T",
                    TranslatedString = TranslatedString.FromJson("{\"en\":\"Hello world!\",\"nl\":\"Hallo wereld!\"}"),
                    CommonMark = "**Hello world!**",
                    StringLower = "test",
                    StringUpper = "TEST",
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
                    Boolean = true,
                    YesNo = true,
                    Reference = Context.People.First(),
                    ReferenceWithCanAddNew = Context.People.First(),
                    ReferenceWithSelectInPlace = Context.People.First(),
                    ReferenceAsChipHorizontal = Context.People.First(),
                    ReferenceAsChipVertical = Context.People.First(),
                    ReferenceAsRadioHorizontal = Context.People.First(),
                    ReferenceAsRadioVertical = Context.People.First(),
                    AsDetail = Context.PeopleTop10().ToList(),
                    AsDetailReadOnly = Context.PeopleTop10().ToList(),
                    KeyValueList = 1,
                    KeyValueListAsChipVertical = 1,
                    KeyValueListAsChipHorizontal = 1,
                    KeyValueListAsRadioVertical = 1,
                    KeyValueListAsRadioHorizontal = 1,
                    ComboBox = "Bla",
                    DropDown = "Monday",
                    DropDownAsChipHorizontal = "Monday",
                    DropDownAsChipVertical = "Monday",
                    DropDownAsRadioHorizontal = "Monday",
                    DropDownAsRadioVertical = "Monday",
                    Enum = DayOfWeek.Monday,
                    EnumAsChipHorizontal = DayOfWeek.Monday,
                    EnumAsChipVertical = DayOfWeek.Monday,
                    EnumAsRadioHorizontal = DayOfWeek.Monday,
                    EnumAsRadioVertical = DayOfWeek.Monday,
                    Date = DateTime.Today,
                    DateTime = DateTime.Now,
                    DateTimeOffset = DateTimeOffset.Now,
                    Time = DateTime.Now.TimeOfDay,
                    User = Manager.Current.GetUser("Admin")!.Id,
                    Group = Manager.Current.GetGroup("Administrators")!.Id,
                    Image = image,
                    BinaryFile = "Vidyano.png|iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAmAAAAJgBosiCmAAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAI2SURBVFiFvZe/a1NRFMc/pwYxdhHBURwc6iaIf4A4WAQ3FSflJdYMioNIXYuzrYqFKioJjaUUBMWluKmDONjFRURBiYv4oxqk1RKT93VoqjHem/fy8tIDGe753nO+n+Tm3vueSSLNsLu2kWU2O8UK3zWmsDU1kKo7wBIziG+OzwuXX6oANm07gcMe+arGVO8rACHnPT2r/OSWqyQ1ACvZNiBwi9zQaS31FQDjLJB1KDVqXPOVpQJgd2wQccYjz6igD30FoMEIsNWhCJjoVNozgF20DOKcW2ReOb3sKwDbOQbscGriUlR57wDGqEd5rpyeRJVnnD1LdgRxACMLbMLIIrJARTnlW+YNA7s9YJHf3guA8QU49Wf897oIrWyjOqHF5viCp+9bBrkXB8C5BAr0GHjlnN/gIIAVbS+w39lVXNZRNRIDNOO6J38I6LT2i9QpxTHvDGCUgR8OZdiKNoTv0jGmVJCrrjsABaoCcw5pC8YssMGhrSAm45p3BFil8C7DHk9+Wjl9Tg1AeS0ACzF7hVjnY7drAADM+yu0xwMFepM+QI05oBo5L8axmwig+Y8uR5g/VV7P+gIARC/DAONJzAEs7mO5lewRsO8/Qbwmzy6R7Pk+/m3o25LGRFLz7gDq3Ac+tmU/NU/MxBEbQAX9Am63pScVaGVdAADIcBNYe7VaJmSqF/OuAXRc74H51QFFndTXdQUA1rZkg5ArvZonA6jwEBjXiN6lARD7HPinCLNetl5r/AankcH9UZDjdgAAAABJRU5ErkJggg==",
                },
                DevContext.Version);
        }

        return _cache.Item1;
    }

    public override void OnLoad(PersistentObject obj, PersistentObject? parent)
    {
        if (!string.IsNullOrWhiteSpace(obj.ObjectId))
        {
            var spec = obj.ObjectId
                .Split(';', StringSplitOptions.RemoveEmptyEntries)
                .Select(e => e.Split(':', StringSplitOptions.RemoveEmptyEntries))
                .Where(p => p.Length > 0)
                .ToDictionary(
                    p => p[0].Trim(),
                    p => p.Skip(1).Select(m => m.Trim().ToLowerInvariant()).ToArray(),
                    StringComparer.OrdinalIgnoreCase);

            foreach (var attr in obj.Attributes.ToList())
            {
                if (!spec.TryGetValue(attr.Name, out var mods))
                {
                    obj.RemoveAttribute(attr.Name);
                    continue;
                }

                attr.IsReadOnly  = mods.Contains("readonly");
                attr.IsSensitive = mods.Contains("sensitive");
            }
        }

        base.OnLoad(obj, parent);
    }
}

public class Attributes
{
    public string String { get; init; } = null!;

    public string MultiLineString { get; init; } = null!;

    public string MultiString { get; init; } = null!;

    public string MultiStringWithTags { get; init; } = null!;

    public string Password { get; init; } = null!;

    public TranslatedString TranslatedString { get; init; } = null!;

    public string CommonMark { get; init; } = null!;

    public string StringLower { get; init; } = null!;

    public string StringUpper { get; init; } = null!;

    public Byte Byte { get; init; }

    public Decimal Decimal { get; init; }

    public Double Double { get; init; }

    public Single Single { get; init; }

    public Int16 Int16 { get; init; }

    public Int32 Int32 { get; init; }

    public Int64 Int64 { get; init; }

    public SByte SByte { get; init; }

    public UInt16 UInt16 { get; init; }

    public UInt32 UInt32 { get; init; }

    public UInt64 UInt64 { get; init; }

    public bool Boolean { get; set; }

    public bool? NullableBoolean { get; set; }

    public bool YesNo { get; set; }

    public Person Reference { get; set; } = null!;

    public Person ReferenceWithCanAddNew { get; set; } = null!;

    public Person ReferenceWithSelectInPlace { get; set; } = null!;

    public Person ReferenceAsChipHorizontal { get; set; } = null!;

    public Person ReferenceAsRadioHorizontal { get; set; } = null!;

    public Person ReferenceAsChipVertical { get; set; } = null!;

    public Person ReferenceAsRadioVertical { get; set; } = null!;

    public ICollection<Person> AsDetail { get; set; } = null!;

    public ICollection<Person> AsDetailReadOnly { get; set; } = null!;

    public int KeyValueList { get; set; }

    public int KeyValueListAsChipVertical { get; set; }

    public int KeyValueListAsChipHorizontal { get; set; }

    public int KeyValueListAsRadioVertical { get; set; }

    public int KeyValueListAsRadioHorizontal { get; set; }

    public string ComboBox { get; set; } = null!;

    public string DropDown { get; set; } = null!;

    public string DropDownAsChipHorizontal { get; set; } = null!;

    public string DropDownAsChipVertical { get; set; } = null!;

    public string DropDownAsRadioHorizontal { get; set; } = null!;

    public string DropDownAsRadioVertical { get; set; } = null!;

    public DayOfWeek Enum { get; set; }

    public DayOfWeek EnumAsChipHorizontal { get; set; }

    public DayOfWeek EnumAsChipVertical { get; set; }

    public DayOfWeek EnumAsRadioHorizontal { get; set; }

    public DayOfWeek EnumAsRadioVertical { get; set; }

    public AttributeVisibility FlagsEnum { get; set; }

    public DateTime Date { get; set; }

    public DateTime DateTime { get; set; }

    public DateTimeOffset DateTimeOffset { get; set; }

    public TimeSpan Time { get; set; }

    public DateTime? NullableDate { get; set; } = null;

    public DateTime? NullableDateTime { get; set; } = null;

    public DateTimeOffset? NullableDateTimeOffset { get; set; } = null;

    public TimeSpan? NullableTime { get; set; } = null;

    public Guid User { get; set; }

    public Guid Group { get; set; }

    public Guid? NullableUser { get; set; }

    public byte[] Image { get; set; } = null!;

    public string BinaryFile { get; set; } = null!;
}