using Bogus;
using Dev.Service.Model;
using Vidyano.Service;

using Person = Dev.Service.Model.Person;

namespace Dev.Service;

public partial class DevContext : NullTargetContext
{
    public static List<Person> _people = [];

    public static void Initialize()
    {
        Randomizer.Seed = new Random(6841844);

        var addressFaker = new Faker<Address>("nl_BE")
            .RuleFor(a => a.Id, f => f.IndexFaker + 1)
            .RuleFor(a => a.Street, f => f.Address.StreetAddress())
            .RuleFor(a => a.City, f => f.Address.City())
            .RuleFor(a => a.State, f => f.Address.State())
            .RuleFor(a => a.ZipCode, f => f.Address.ZipCode())
            .RuleFor(a => a.Country, f => "Belgium")
            .RuleFor(a => a.IsPrimary, false);

        var personLanguageFaker = new Faker<PersonLanguage>("nl_BE")
            .RuleFor(l => l.Id, f => f.IndexFaker + 1)
            .RuleFor(l => l.Language, f => f.Random.WeightedRandom(["Dutch", "French", "English", "German", "Spanish", "Portuguese", "Italian"], [0.3f, 0.25f, 0.2f, 0.1f, 0.08f, 0.04f, 0.03f]))
            .RuleFor(l => l.ProficiencyLevel, f => f.PickRandom("Native", "Fluent", "Advanced", "Intermediate", "Basic", "Beginner"))
            .RuleFor(l => l.CanSpeak, f => f.Random.Bool(0.9f))
            .RuleFor(l => l.CanRead, f => f.Random.Bool(0.85f))
            .RuleFor(l => l.CanWrite, f => f.Random.Bool(0.75f))
            .RuleFor(l => l.IsNative, false)
            .RuleFor(l => l.YearsStudied, f => f.Random.Int(0, 15))
            .RuleFor(l => l.CertificationLevel, f => f.PickRandom("A1", "A2", "B1", "B2", "C1", "C2"));

        var peopleFaker = new Faker<Person>("nl_BE")
            .RuleFor(p => p.Id, f => f.IndexFaker + 1)
            .RuleFor(p => p.FirstName, f => f.Name.FirstName())
            .RuleFor(p => p.LastName, f => f.Name.LastName())
            .RuleFor(p => p.BirthDate, f => f.Date.Between(new DateTime(1945, 1, 1), new DateTime(2000, 12, 31)))
            .RuleFor(p => p.Gender, f => f.PickRandom<Gender>())
            .RuleFor(p => p.ContactPreference, f => f.PickRandom<ContactPreference>())
            .RuleFor(p => p.Email, (f, p) => f.Internet.Email(p.FirstName, p.LastName))
            .RuleFor(p => p.PhoneNumber, f => f.Phone.PhoneNumber("047# ## ## ##"))
            .RuleFor(p => p.IsActive, f => f.Random.Bool(.95f))
            .RuleFor(p => p.Addresses, f =>
            {
                var numberOfAddresses = f.Random.Int(1, 3);
                var addresses = addressFaker.Generate(numberOfAddresses);

                // Set one random address as primary
                addresses[f.Random.Int(0, numberOfAddresses - 1)].IsPrimary = true;

                return addresses;
            })
            .RuleFor(p => p.Languages, f =>
            {
                var count = f.Random.WeightedRandom([1, 2, 3, 4], [0.4f, 0.45f, 0.12f, 0.03f]);
                var languages = personLanguageFaker.Generate(count);

                // Ensure unique languages (in case of duplicates)
                languages = [.. languages.GroupBy(l => l.Language).Select(g => g.First())];

                // Set one random language as native
                if (languages.Count != 0)
                {
                    var nativeIndex = f.Random.Int(0, languages.Count - 1);
                    languages[nativeIndex].IsNative = true;
                    languages[nativeIndex].ProficiencyLevel = "Native";
                    languages[nativeIndex].CanSpeak = true;
                    languages[nativeIndex].CanRead = true;
                    languages[nativeIndex].CanWrite = true;
                }

                return languages;
            });

        _people = peopleFaker.Generate(10_000);

        var rnd = new Random();
        _people.ForEach(p =>
        {
            // Set emergency contact to a random person from the list
            p.EmergencyContact = _people[rnd.Next(_people.Count)];
        });

        Version++;
    }

    public static int Version { get; private set; } = 1;

    public IQueryable<Person> People => _people.AsQueryable();

    public IQueryable<Person> PeopleTop10()
    {
        return People.Take(10);
    }

    //public IQueryable<Address> Addresses()
    //{
    //    return _people.SelectMany(p => p.Addresses).AsQueryable();
    //}
}