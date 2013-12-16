require_relative '../tuilookup'

# These are regression tests for some bugs that I noticed and
# fixed in an earlier version of tuilookup.rb.

describe "TUILookup", "regression testing of old bugs" do
    it "should recognize correct spelling of diagnostic aid" do
        t = TUILookup.new
        t.lookup("diagnostic aid").should eql (["T130"])
    end
    it "should recognize correct spelling of biogenic amine" do
        t = TUILookup.new
        t.lookup("biogenic amine").should eql (["T124"])
    end
end

# These are regular functionality tests
 
describe "TUILookup", "basic functionality" do
    it "should return correct results for just a single TUI" do
        t = TUILookup.new
        t.lookup("gene").should eql (["T028"])
    end
    it "should return correct results for multiple TUIs"
    it "should handle situation correctly if no TUIs are found"
    it "should handle mixed case input" do
       t = TUILookup.new
       t.lookup("Gene").should eql (["T028"])
    end   
    it "should handle upper-case input" do
       t = TUILookup.new
       t.lookup("GENE").should	 
    end   
    it "should handle lower-case input" do
       t = TUILookup.new
       t.lookup("gene").should 
    end
    it "should handle leading and trailing whitespace" do
       t = TUILookup.new
       t.lookup(" gene ").should  
    end
end

# These are error-handling tests

describe "TUILookup", "error handling" do
    it "should handle nonexistent input file"
    it "should handle null file name"
    it "should handle empty file name"
    it "should handle null input to lookup" do
        t = TUILookup.new
        word = nil
        t.lookup(word).should eql([])
        # I'm not sure that this is the best way to handle this--
        # it's probably better to throw an exception
    end
    it "should handle empty input to lookup" do
        t = TUILookup.new
	word = ""
        t.lookup(word).should eql([])
	# I'm not sure that this is the best way to handle this--
        # it's probably better to throw an exception
    end
