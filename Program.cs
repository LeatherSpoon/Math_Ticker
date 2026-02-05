using System;
using System.Windows.Forms;

namespace MathTicker;

internal static class Program
{
    [STAThread]
    private static void Main()
    {
        ApplicationConfiguration.Initialize();
        Application.Run(new TickerForm());
    }
}
