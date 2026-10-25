namespace Dev.Service.Model;

/// <summary>
/// Read-only test data with 60+ columns for the vi-query-grid wide grid tests (query QueryGrid_Wide).
/// </summary>
public class WideRow
{
    public int Id { get; set; }

    public string Text01 { get; set; } = null!;

    public string Text02 { get; set; } = null!;

    public string Text03 { get; set; } = null!;

    public string Text04 { get; set; } = null!;

    public string Text05 { get; set; } = null!;

    public string Text06 { get; set; } = null!;

    public string Text07 { get; set; } = null!;

    public string Text08 { get; set; } = null!;

    public string Text09 { get; set; } = null!;

    public string Text10 { get; set; } = null!;

    public string Text11 { get; set; } = null!;

    public string Text12 { get; set; } = null!;

    public string Text13 { get; set; } = null!;

    public string Text14 { get; set; } = null!;

    public string Text15 { get; set; } = null!;

    public string Text16 { get; set; } = null!;

    public string Text17 { get; set; } = null!;

    public string Text18 { get; set; } = null!;

    public string Text19 { get; set; } = null!;

    public string Text20 { get; set; } = null!;

    public int Int01 { get; set; }

    public int Int02 { get; set; }

    public int Int03 { get; set; }

    public int Int04 { get; set; }

    public int Int05 { get; set; }

    public int Int06 { get; set; }

    public int Int07 { get; set; }

    public int Int08 { get; set; }

    public int Int09 { get; set; }

    public int Int10 { get; set; }

    public decimal Dec01 { get; set; }

    public decimal Dec02 { get; set; }

    public decimal Dec03 { get; set; }

    public decimal Dec04 { get; set; }

    public decimal Dec05 { get; set; }

    public DateTime Date01 { get; set; }

    public DateTime Date02 { get; set; }

    public DateTime Date03 { get; set; }

    public DateTime Date04 { get; set; }

    public DateTime Date05 { get; set; }

    public DateTime DateTime01 { get; set; }

    public DateTime DateTime02 { get; set; }

    public DateTime DateTime03 { get; set; }

    public TimeSpan Time01 { get; set; }

    public TimeSpan Time02 { get; set; }

    public bool Flag01 { get; set; }

    public bool Flag02 { get; set; }

    public bool Flag03 { get; set; }

    public bool Flag04 { get; set; }

    public bool Flag05 { get; set; }

    public bool? NFlag01 { get; set; }

    public bool? NFlag02 { get; set; }

    public bool YesNo01 { get; set; }

    public WideColor Enum01 { get; set; }

    public WideSize Enum02 { get; set; }

    public WideStatus Enum03 { get; set; }

    public WidePriority Enum04 { get; set; }

    public byte[]? Image01 { get; set; }

    public string Markdown01 { get; set; } = null!;
}

public enum WideColor
{
    Red,
    Green,
    Blue,
    Yellow
}

public enum WideSize
{
    Small,
    Medium,
    Large
}

public enum WideStatus
{
    Draft,
    Active,
    Archived
}

public enum WidePriority
{
    Low,
    Normal,
    High,
    Critical
}
