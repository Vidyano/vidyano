namespace Dev.Service.Model;

public class Person
{
    public int Id { get; set; }

    public string FirstName { get; set; } = null!;

    public string LastName { get; set; } = null!;

    public string FullName => $"{FirstName} {LastName}";

    public ContactPreference ContactPreference { get; set; }

    public string Email { get; set; } = null!;

    public string PhoneNumber { get; set; } = null!;

    public DateTime BirthDate { get; set; }

    public Gender Gender { get; set; }

    public Person EmergencyContact { get; set; } = null!;

    public List<Address> Addresses { get; set; } = [];

    public List<PersonLanguage> Languages { get; set; } = [];

    public bool IsActive { get; set; }
}

public enum ContactPreference
{
    Email,
    Phone
}

public enum Gender
{
    Female,
    Male
}