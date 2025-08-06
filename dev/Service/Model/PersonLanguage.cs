using Vidyano.Service.Repository;

namespace Dev.Service.Model;

[ValueObject]
public class PersonLanguage
{
    [ValueKey]
    public int Id { get; set; }

    public string Language { get; set; } = null!;

    public string ProficiencyLevel { get; set; } = null!;

    public bool CanSpeak { get; set; }

    public bool CanRead { get; set; }

    public bool CanWrite { get; set; }

    public bool IsNative { get; set; }

    public int YearsStudied { get; set; }

    public string? CertificationLevel { get; set; }
}
