using Bogus;
using Dev.Service.Model;

using Person = Dev.Service.Model.Person;

namespace Dev.Service;

/// <summary>
/// Read-only test data for the vi-query-grid Playwright tests (packages/vidyano/tests/query-grid/README.md).
/// Everything is rebuilt deterministically by <see cref="InitializeQueryGridData"/>, which runs from
/// <see cref="Initialize"/> (on startup and on every PersistentObject.ResetTest).
/// </summary>
public partial class DevContext
{
    public const int GridDataTypesSeed = 1001;
    public const int WideRowsSeed = 1002;
    public const int ReorderItemsSeed = 1003;
    public const int ReorderItemsLargeSeed = 1004;
    public const int ContinuationRowsSeed = 1005;

    public const int GridDataTypeFixedRows = 12;
    public const int GridDataTypeGeneratedRows = 200;
    public const int PeopleBigCount = 150_000;
    public const int WideRowCount = 2_000;
    public const int ReorderItemCount = 12;
    public const int ReorderItemLargeCount = 250;
    public const int ReorderItemLargeIdOffset = 1000;
    public const int ContinuationRowCount = 1_234;

    // 32x32 PNG, same image as AttributesActions
    public static readonly byte[] QueryGridImage = Convert.FromBase64String("iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAmAAAAJgBosiCmAAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAI2SURBVFiFvZe/a1NRFMc/pwYxdhHBURwc6iaIf4A4WAQ3FSflJdYMioNIXYuzrYqFKioJjaUUBMWluKmDONjFRURBiYv4oxqk1RKT93VoqjHem/fy8tIDGe753nO+n+Tm3vueSSLNsLu2kWU2O8UK3zWmsDU1kKo7wBIziG+OzwuXX6oANm07gcMe+arGVO8rACHnPT2r/OSWqyQ1ACvZNiBwi9zQaS31FQDjLJB1KDVqXPOVpQJgd2wQccYjz6igD30FoMEIsNWhCJjoVNozgF20DOKcW2ReOb3sKwDbOQbscGriUlR57wDGqEd5rpyeRJVnnD1LdgRxACMLbMLIIrJARTnlW+YNA7s9YJHf3guA8QU49Wf897oIrWyjOqHF5viCp+9bBrkXB8C5BAr0GHjlnN/gIIAVbS+w39lVXNZRNRIDNOO6J38I6LT2i9QpxTHvDGCUgR8OZdiKNoTv0jGmVJCrrjsABaoCcw5pC8YssMGhrSAm45p3BFil8C7DHk9+Wjl9Tg1AeS0ACzF7hVjnY7drAADM+yu0xwMFepM+QI05oBo5L8axmwig+Y8uR5g/VV7P+gIARC/DAONJzAEs7mO5lewRsO8/Qbwmzy6R7Pk+/m3o25LGRFLz7gDq3Ac+tmU/NU/MxBEbQAX9Am63pScVaGVdAADIcBNYe7VaJmSqF/OuAXRc74H51QFFndTXdQUA1rZkg5ArvZonA6jwEBjXiN6lARD7HPinCLNetl5r/AankcH9UZDjdgAAAABJRU5ErkJggg==");

    public static List<GridDataType> _gridDataTypes = [];
    public static List<Person> _peopleBig = [];
    public static List<WideRow> _wideRows = [];
    public static List<ReorderItem> _reorderItems = [];
    public static List<ReorderItem> _reorderItemsLarge = [];
    public static List<ContinuationRow> _continuationRows = [];

    static void InitializeQueryGridData()
    {
        _gridDataTypes = CreateGridDataTypes();
        _peopleBig = CreatePeopleBig(_people);
        _wideRows = CreateWideRows();
        _reorderItems = CreateReorderItems(ReorderItemsSeed, ReorderItemCount, 0, "00");
        _reorderItemsLarge = CreateReorderItems(ReorderItemsLargeSeed, ReorderItemLargeCount, ReorderItemLargeIdOffset, "000");
        _continuationRows = CreateContinuationRows();
    }

    public IQueryable<GridDataType> GridDataTypes => _gridDataTypes.AsQueryable();

    public IQueryable<Person> PeopleBig() => _peopleBig.AsQueryable();

    public IQueryable<WideRow> WideRows => _wideRows.AsQueryable();

    /// <summary>
    /// Both reorder lists (used to load a single item by id; ids do not overlap).
    /// </summary>
    public IQueryable<ReorderItem> AllReorderItems => _reorderItems.Concat(_reorderItemsLarge).AsQueryable();

    public IQueryable<ReorderItem> ReorderItems() => _reorderItems.AsQueryable();

    public IQueryable<ReorderItem> ReorderItemsLarge() => _reorderItemsLarge.AsQueryable();

    /// <summary>
    /// All continuation rows (used to load a single item by id; the query pages them in ContinuationRowActions.ContinuationPages).
    /// </summary>
    public IQueryable<ContinuationRow> ContinuationRows => _continuationRows.AsQueryable();

    static List<GridDataType> CreateGridDataTypes()
    {
        var dateTime = new DateTime(2024, 1, 15, 13, 45, 30);
        var dateTimeOffset = new DateTimeOffset(dateTime, TimeSpan.FromHours(2));
        var time = new TimeSpan(13, 45, 30);
        var date = new DateTime(2024, 2, 29);

        GridDataType Fixed(int id, string? text, string? commonMark, int int32 = 42, decimal dec = 1234.5m) => new()
        {
            Id = id,
            Text = text,
            MultiLine = text == null ? null : $"{text} line 1\n{text} line 2",
            Int32 = int32,
            NullableInt32 = 7,
            Decimal = dec,
            DecimalFormatted = 1234567.891m,
            Double = 3.14159,
            Int64 = 9_007_199_254_740_993L,
            DateTime = dateTime,
            DateTimeOffset = dateTimeOffset,
            Time = time,
            NullableDate = date,
            NullableBoolean = true,
            NullableBooleanPlain = true,
            YesNo = true,
            Image = QueryGridImage,
            CommonMark = commonMark,
            Secret = text == null ? null : $"secret-{id}"
        };

        var rows = new List<GridDataType>
        {
            Fixed(1, "Alpha", "**bold** text"),
            new()
            {
                // Every nullable value is null (non-nullable values are their defaults)
                Id = 2,
                DateTime = dateTime,
                DateTimeOffset = dateTimeOffset
            },
            new()
            {
                // Empty strings
                Id = 3,
                Text = "",
                MultiLine = "",
                Int32 = 0,
                NullableInt32 = 0,
                Decimal = 0m,
                DecimalFormatted = 0m,
                Double = 0d,
                Int64 = 0L,
                DateTime = dateTime,
                DateTimeOffset = dateTimeOffset,
                Time = TimeSpan.Zero,
                NullableDate = date,
                NullableBoolean = false,
                NullableBooleanPlain = false,
                YesNo = false,
                Image = null,
                CommonMark = "",
                Secret = ""
            },
            Fixed(4, "Delta", "[People](http://localhost:5000/home/people)", int32: -17, dec: -0.5m),
            Fixed(5, "Echo", "[Hashbang](#!/home/people)"),
            Fixed(6, "Foxtrot", "[External](https://www.vidyano.com/)"),
            Fixed(7, "Golf", "[**Bold link**](http://localhost:5000/home/people)"),
            Fixed(8, "<b>not bold</b>", "<script>window.__xss = 'script';</script>"),
            Fixed(9, "Img", "<img src=x onerror=\"window.__xss = 'img'\">"),
            Fixed(10, "JavaScript href", "[click me](javascript:window.__xss='href')"),
            Fixed(11, "Iframe", "<iframe src=\"https://www.vidyano.com/\"></iframe>"),
            Fixed(12, "Style", "<style>body { display: none !important; }</style>after style"),
        };

        var faker = new Faker<GridDataType>("en")
            .UseSeed(GridDataTypesSeed)
            .RuleFor(r => r.Id, f => GridDataTypeFixedRows + f.IndexFaker + 1)
            .RuleFor(r => r.Text, f => f.Commerce.ProductName())
            .RuleFor(r => r.MultiLine, f => f.Lorem.Lines(2, "\n"))
            .RuleFor(r => r.Int32, f => f.Random.Int(-1000, 1000))
            .RuleFor(r => r.NullableInt32, f => f.IndexFaker % 4 == 0 ? null : f.Random.Int(0, 100))
            .RuleFor(r => r.Decimal, f => Math.Round(f.Random.Decimal(-1000m, 1000m), 2))
            .RuleFor(r => r.DecimalFormatted, f => Math.Round(f.Random.Decimal(0m, 1_000_000m), 3))
            .RuleFor(r => r.Double, f => Math.Round(f.Random.Double(-100d, 100d), 4))
            .RuleFor(r => r.Int64, f => f.Random.Long(-1_000_000_000_000L, 1_000_000_000_000L))
            .RuleFor(r => r.DateTime, f => f.Date.Between(new DateTime(2020, 1, 1), new DateTime(2025, 12, 31)))
            .RuleFor(r => r.DateTimeOffset, f => new DateTimeOffset(f.Date.Between(new DateTime(2020, 1, 1), new DateTime(2025, 12, 31)), TimeSpan.FromHours(2)))
            .RuleFor(r => r.Time, f => TimeSpan.FromSeconds(f.Random.Int(0, 86_399)))
            .RuleFor(r => r.NullableDate, f => f.IndexFaker % 5 == 0 ? null : f.Date.Between(new DateTime(2020, 1, 1), new DateTime(2025, 12, 31)).Date)
            .RuleFor(r => r.NullableBoolean, f => (f.IndexFaker % 3) switch { 0 => null, 1 => true, _ => false })
            .RuleFor(r => r.NullableBooleanPlain, f => (f.IndexFaker % 3) switch { 0 => null, 1 => true, _ => false })
            .RuleFor(r => r.YesNo, f => f.IndexFaker % 2 == 0)
            .RuleFor(r => r.Image, f => f.IndexFaker % 2 == 0 ? QueryGridImage : null)
            .RuleFor(r => r.CommonMark, f => $"**{f.Commerce.ProductAdjective()}** {f.Commerce.ProductMaterial()}")
            .RuleFor(r => r.Secret, f => f.Internet.Password(12));

        rows.AddRange(faker.Generate(GridDataTypeGeneratedRows));

        return rows;
    }

    static List<Person> CreatePeopleBig(List<Person> source)
    {
        var result = new List<Person>(PeopleBigCount);
        if (source.Count == 0)
            return result;

        for (var i = 0; i < PeopleBigCount; i++)
        {
            var p = source[i % source.Count];
            result.Add(new Person
            {
                Id = i + 1,
                FirstName = p.FirstName,
                LastName = p.LastName,
                ContactPreference = p.ContactPreference,
                Email = p.Email,
                PhoneNumber = p.PhoneNumber,
                BirthDate = p.BirthDate,
                Gender = p.Gender,
                EmergencyContact = p.EmergencyContact,
                Addresses = p.Addresses,
                Languages = p.Languages,
                IsActive = p.IsActive
            });
        }

        return result;
    }

    static List<WideRow> CreateWideRows()
    {
        var start = new DateTime(2000, 1, 1);
        var end = new DateTime(2030, 12, 31);

        var faker = new Faker<WideRow>("en")
            .UseSeed(WideRowsSeed)
            .RuleFor(r => r.Id, f => f.IndexFaker + 1)
            .RuleFor(r => r.Text01, f => f.Name.FirstName())
            .RuleFor(r => r.Text02, f => f.Name.LastName())
            .RuleFor(r => r.Text03, f => f.Address.City())
            .RuleFor(r => r.Text04, f => f.Address.Country())
            .RuleFor(r => r.Text05, f => f.Internet.Email())
            .RuleFor(r => r.Text06, f => f.Company.CompanyName())
            .RuleFor(r => r.Text07, f => f.Commerce.ProductName())
            .RuleFor(r => r.Text08, f => f.Lorem.Word())
            .RuleFor(r => r.Text09, f => f.Lorem.Sentence())
            .RuleFor(r => r.Text10, f => f.Lorem.Paragraph())
            .RuleFor(r => r.Text11, f => f.Random.AlphaNumeric(3))
            .RuleFor(r => r.Text12, f => f.Random.AlphaNumeric(40))
            .RuleFor(r => r.Text13, f => f.Phone.PhoneNumber())
            .RuleFor(r => r.Text14, f => f.Address.StreetAddress())
            .RuleFor(r => r.Text15, f => f.Commerce.Department())
            .RuleFor(r => r.Text16, f => f.Hacker.Phrase())
            .RuleFor(r => r.Text17, f => f.Random.Word())
            .RuleFor(r => r.Text18, f => f.Lorem.Sentences(3, " "))
            .RuleFor(r => r.Text19, f => f.Random.Char('A', 'Z').ToString())
            .RuleFor(r => r.Text20, f => f.Random.Guid().ToString())
            .RuleFor(r => r.Int01, f => f.Random.Int(0, 9))
            .RuleFor(r => r.Int02, f => f.Random.Int(0, 99))
            .RuleFor(r => r.Int03, f => f.Random.Int(0, 999))
            .RuleFor(r => r.Int04, f => f.Random.Int(0, 9_999))
            .RuleFor(r => r.Int05, f => f.Random.Int(0, 99_999))
            .RuleFor(r => r.Int06, f => f.Random.Int(-1_000, 1_000))
            .RuleFor(r => r.Int07, f => f.Random.Int(-1_000_000, 1_000_000))
            .RuleFor(r => r.Int08, f => f.Random.Int())
            .RuleFor(r => r.Int09, f => f.Random.Int(1, 5))
            .RuleFor(r => r.Int10, f => f.IndexFaker + 1)
            .RuleFor(r => r.Dec01, f => Math.Round(f.Random.Decimal(0m, 10m), 2))
            .RuleFor(r => r.Dec02, f => Math.Round(f.Random.Decimal(0m, 1_000m), 2))
            .RuleFor(r => r.Dec03, f => Math.Round(f.Random.Decimal(-1_000m, 1_000m), 4))
            .RuleFor(r => r.Dec04, f => Math.Round(f.Random.Decimal(0m, 1_000_000m), 2))
            .RuleFor(r => r.Dec05, f => Math.Round(f.Random.Decimal(0m, 1m), 6))
            .RuleFor(r => r.Date01, f => f.Date.Between(start, end).Date)
            .RuleFor(r => r.Date02, f => f.Date.Between(start, end).Date)
            .RuleFor(r => r.Date03, f => f.Date.Between(start, end).Date)
            .RuleFor(r => r.Date04, f => f.Date.Between(start, end).Date)
            .RuleFor(r => r.Date05, f => f.Date.Between(start, end).Date)
            .RuleFor(r => r.DateTime01, f => f.Date.Between(start, end))
            .RuleFor(r => r.DateTime02, f => f.Date.Between(start, end))
            .RuleFor(r => r.DateTime03, f => f.Date.Between(start, end))
            .RuleFor(r => r.Time01, f => TimeSpan.FromMinutes(f.Random.Int(0, 1_439)))
            .RuleFor(r => r.Time02, f => TimeSpan.FromSeconds(f.Random.Int(0, 86_399)))
            .RuleFor(r => r.Flag01, f => f.Random.Bool())
            .RuleFor(r => r.Flag02, f => f.Random.Bool(0.1f))
            .RuleFor(r => r.Flag03, f => f.Random.Bool(0.9f))
            .RuleFor(r => r.Flag04, f => f.Random.Bool())
            .RuleFor(r => r.Flag05, f => f.Random.Bool())
            .RuleFor(r => r.NFlag01, f => f.Random.Bool(0.3f) ? null : f.Random.Bool())
            .RuleFor(r => r.NFlag02, f => f.Random.Bool(0.3f) ? null : f.Random.Bool())
            .RuleFor(r => r.YesNo01, f => f.Random.Bool())
            .RuleFor(r => r.Enum01, f => f.PickRandom<WideColor>())
            .RuleFor(r => r.Enum02, f => f.PickRandom<WideSize>())
            .RuleFor(r => r.Enum03, f => f.PickRandom<WideStatus>())
            .RuleFor(r => r.Enum04, f => f.PickRandom<WidePriority>())
            .RuleFor(r => r.Image01, f => f.Random.Bool() ? QueryGridImage : null)
            .RuleFor(r => r.Markdown01, f => $"**{f.Commerce.ProductAdjective()}** _{f.Commerce.ProductMaterial()}_");

        return faker.Generate(WideRowCount);
    }

    static List<ReorderItem> CreateReorderItems(int seed, int count, int idOffset, string nameFormat)
    {
        var faker = new Faker<ReorderItem>("en")
            .UseSeed(seed)
            .RuleFor(r => r.Id, f => idOffset + f.IndexFaker + 1)
            .RuleFor(r => r.Name, f => $"Item {(f.IndexFaker + 1).ToString(nameFormat)}")
            .RuleFor(r => r.Description, f => f.Commerce.ProductName())
            .RuleFor(r => r.Offset, f => (f.IndexFaker + 1) * 10);

        return faker.Generate(count);
    }

    static List<ContinuationRow> CreateContinuationRows()
    {
        var faker = new Faker<ContinuationRow>("en")
            .UseSeed(ContinuationRowsSeed)
            .RuleFor(r => r.Id, f => f.IndexFaker + 1)
            .RuleFor(r => r.Code, f => $"Row {f.IndexFaker + 1:0000}")
            .RuleFor(r => r.Name, f => f.Commerce.ProductName())
            .RuleFor(r => r.Department, f => f.Commerce.Department(1))
            .RuleFor(r => r.Amount, f => Math.Round(f.Random.Decimal(0m, 10_000m), 2))
            .RuleFor(r => r.Date, f => f.Date.Between(new DateTime(2020, 1, 1), new DateTime(2025, 12, 31)).Date);

        return faker.Generate(ContinuationRowCount);
    }
}
