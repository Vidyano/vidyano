using Bogus;
using Dev.Service.Model;
using Vidyano.Service;

using Person = Dev.Service.Model.Person;

namespace Dev.Service;

public partial class DevContext : NullTargetContext
{
    static List<Person> _people = [];

    public static void Initialize()
    {
        Randomizer.Seed = new Random(6841844);

        _people = new Faker<Person>()
            .RuleFor(p => p.Id, f => f.IndexFaker + 1)
            .RuleFor(p => p.FirstName, f => f.Name.FirstName())
            .RuleFor(p => p.LastName, f => f.Name.LastName())
            .RuleFor(p => p.BirthDate, f => f.Date.Between(new DateTime(1945, 1, 1), new DateTime(2000, 12, 31)))
            .RuleFor(p => p.Email, (f, p) => f.Internet.Email(p.FirstName, p.LastName))
            .RuleFor(p => p.PhoneNumber, f => f.Phone.PhoneNumber("###-###-####"))
            .RuleFor(p => p.Gender, f => f.PickRandom<Gender>())
            .RuleFor(p => p.IsActive, f => f.Random.Bool(.95f))
            .Generate(10_000);

        Version++;
    }

    public static int Version { get; private set; } = 1;

    public IQueryable<Person> People => _people.AsQueryable();

    public IQueryable<Person> PeopleTop10()
    {
        return People.Take(10);
    }
}